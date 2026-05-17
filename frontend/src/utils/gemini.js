import { formatUserMessage } from './formatUserMessage.js';

const PRIMARY_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';
/** Kota dolunca sırayla dene (test edildi: bu anahtarla 2.5-flash-lite çalışıyor). */
const MODEL_FALLBACKS = [
  PRIMARY_MODEL,
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
].filter((m, i, arr) => m && arr.indexOf(m) === i);

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function isQuotaError(status, message) {
  if (status === 429) return true;
  const t = String(message || '').toLowerCase();
  return t.includes('quota') || t.includes('resource_exhausted') || t.includes('rate limit');
}

export function getGeminiApiKey() {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    sessionStorage.getItem('gemini_api_key') ||
    ''
  );
}

export function setGeminiApiKey(key) {
  if (key) sessionStorage.setItem('gemini_api_key', key);
  else sessionStorage.removeItem('gemini_api_key');
}

function buildSystemPrompt(context) {
  const citySummary = context.zonesByCity
    ?.map(
      (g) =>
        `- ${g.city}: ${g.count} toplanma alanı, toplam kapasite ~${g.totalCapacity} kişi`
    )
    .join('\n');

  const zones = context.safeZones
    ?.slice(0, 15)
    .map(
      (z) =>
        `- ${z.name} (${z.il || 'il yok'}): enlem ${z.lat}, boylam ${z.lng}, kapasite ${z.capacity} kişi`
    )
    .join('\n');

  const allZonesSorted = context.safeZonesWithDistance
    ?.map((z) => `- ${z.name}: ${z.distanceKm} km (${z.lat}, ${z.lng})`)
    .join('\n');

  return `Sen sahAI afet koordinasyon uygulamasının yardımcı asistanısın. Türkçe, sakin ve net konuş.
Deprem sonrası vatandaşlara yardım ediyorsun. Tıbbi teşhis koyma; acil durumda 112 ve AFAD (122) yönlendir.

GÜVENLİ BÖLGELER — ŞEHİR ÖZETİ:
${citySummary || 'Şehir listesi yok'}

ÖRNEK ALANLAR (haritada mor işaretler, il bilgisiyle):
${zones || 'Bilgi yok'}

${allZonesSorted ? `Kullanıcı konumuna göre mesafeler:\n${allZonesSorted}` : ''}

${context.selectedLocation ? `Kullanıcının haritada seçtiği konum: enlem ${context.selectedLocation.lat.toFixed(5)}, boylam ${context.selectedLocation.lng.toFixed(5)}` : 'Kullanıcı henüz haritada konum seçmedi — önce haritaya tıklamasını öner.'}

${context.nearestZone ? `EN YAKIN GÜVENLİ BÖLGE: ${context.nearestZone.name}, yaklaşık ${context.nearestZone.distanceKm} km, koordinat (${context.nearestZone.lat}, ${context.nearestZone.lng})` : ''}

${context.nearestHospital ? `EN YAKIN HASTANE: ${context.nearestHospital.name}${context.nearestHospital.il ? ` (${context.nearestHospital.il})` : ''}, yaklaşık ${context.nearestHospital.distanceKm} km` : ''}

${context.hospitalsWithDistance?.length ? `Yakındaki hastaneler (örnek):\n${context.hospitalsWithDistance.map((h) => `- ${h.name}${h.il ? ` (${h.il})` : ''}: ${h.distanceKm} km`).join('\n')}` : ''}

SORU REHBERİ:
- "En yakın güvenli alan nerede?" → En yakın bölgeyi ad ve mesafe ile söyle; haritada mor kare olduğunu belirt.
- "Buradan güvenli alana nasıl gidebilirim?" → Kullanıcı haritada konum seçtiyse uygulama haritada turkuaz yürüyüş rotasını çizer; bunu belirt. Yürüyüş güvenliyse kısa yön ipuçları ver; yıkık bina/enkaz varsa uzak dur; araç kullanma konusunda dikkatli ol. Konum seçilmediyse önce haritaya tıklamasını söyle.
- "En yakın hastaneye nasıl giderim?" → En yakın hastaneyi ad ve mesafe ile söyle; uygulama haritada yürüyüş rotasını çizer (kırmızı hastane işareti). Yaralı/ acil durumda 112'yi de ara. Konum seçilmediyse önce haritaya tıklamasını söyle.
- "Enkaz altında biri var ne yapmalıyım?" → HEMEN 112/AFAD ara; kendin kazma yapma; seslen; su/ilaç verme; gaz kaçağı/yangın riskine dikkat; uygulamadan acil bildirim yapmayı öner.

Kısa, madde madde, uygulanabilir cevaplar ver. Panik yaratma.`;
}

/**
 * @param {Array<{role: 'user'|'model', text: string}>} messages
 */
async function generateWithModel(apiKey, model, payload) {
  const res = await fetch(
    `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data?.error?.message ?? data?.error;
    const msg = formatUserMessage(raw) || `Gemini API hatası (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Yanıt alınamadı. Lütfen tekrar deneyin.');
  return text.trim();
}

export async function sendGeminiMessage(messages, context = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API anahtarı bulunamadı. frontend/.env dosyasına VITE_GEMINI_API_KEY=... ekleyin veya sohbet ayarlarından girin.'
    );
  }

  const contents = messages.slice(-12).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  const payload = {
    systemInstruction: {
      parts: [{ text: buildSystemPrompt(context) }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  let lastError;
  for (const model of MODEL_FALLBACKS) {
    try {
      return await generateWithModel(apiKey, model, payload);
    } catch (err) {
      lastError = err;
      if (!isQuotaError(err.status, err.message)) break;
    }
  }
  throw lastError || new Error('Gemini yanıt veremedi.');
}

function parseJsonFromGemini(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

/**
 * Ambulans rotası — yıkık bina tespitlerini dikkate alarak ara nokta önerir.
 * @returns {Promise<{ waypoints: Array<{lat:number,lng:number,reason?:string}>; notes: string }>}
 */
export async function planAmbulanceRouteWithGemini({
  hospital,
  destination,
  hazards,
  routeSample,
  avoidRadiusM = 70,
  userAvoidRadiusM = 15,
}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API anahtarı gerekli (frontend/.env veya sohbet ayarları).');
  }

  const hazardList = (hazards || []).slice(0, 40).map((h, i) => ({
    id: i + 1,
    lat: Number(h.lat.toFixed(5)),
    lng: Number(h.lng.toFixed(5)),
    kind: h.kind || 'collapsed',
    collapsed: h.collapsed,
    peopleCount: h.peopleCount,
    label: h.label,
    address: h.address || '',
    bufferM: h.kind === 'user' ? userAvoidRadiusM : avoidRadiusM,
  }));

  const userPrompt = `Yetkili panel — ambulans rota planı.

GÖREV: En yakın hastaneden bildirilen olay noktasına ARAÇ rotası planla.
KURALLAR (kesin):
- Diğer kırmızı dairelere transit sırasında DEĞME; yan sokak / ara yol kullan.
- Yıkık / foto: ${avoidRadiusM} m · Kullanıcı bildirimi: ${userAvoidRadiusM} m tampon.
- Olay yerinin kendi kırmızı alanına varışta GİRİLEBİLİR (en kısa yol).
0–5 ara nokta; transit için kırmızı dışında kalsın.

HASTANE (başlangıç):
${JSON.stringify({ name: hospital.name, lat: hospital.lat, lng: hospital.lng })}

OLAY YERİ (varış — kendi kırmızısına girilebilir):
${JSON.stringify({ name: destination.name, lat: destination.lat, lng: destination.lng, kind: destination.kind })}

KAÇINILACAK NOKTALAR (olay hariç, ${hazardList.length} adet):
${JSON.stringify(hazardList)}

İLK OSRM ARAÇ ROTASI ÖRNEK NOKTALARI (referans):
${JSON.stringify(routeSample || [])}

Yanıtı YALNIZCA şu JSON olarak ver (başka metin yok):
{
  "waypoints": [{"lat": number, "lng": number, "reason": "kısa Türkçe açıklama"}],
  "notes": "Yetkiliye 2-4 cümle Türkçe özet: hangi yıkık alanlardan kaçınıldı, tahmini güvenlik"
}`;

  const res = await fetch(
    `${API_BASE}/${PRIMARY_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `Sen afet koordinasyonunda ambulans rota planlayıcısısın. Koordinatlar WGS84 (lat, lng).
Transitte diğer kırmızılara girme; olay yerine en kısa güvenli yol. Yan sokaklar. Sadece JSON.`,
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data?.error?.message ?? data?.error;
    throw new Error(formatUserMessage(raw) || `Gemini API hatası (${res.status})`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini rota yanıtı alınamadı.');

  const parsed = parseJsonFromGemini(text);
  const waypoints = (parsed.waypoints || [])
    .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lng))
    .map((w) => ({
      lat: w.lat,
      lng: w.lng,
      reason: w.reason || '',
    }));

  return {
    waypoints,
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
  };
}

/**
 * Fotoğraf — enkaz / yol kapalı / riskli bölge (Gemini Vision).
 * @returns {Promise<{ isRisky: boolean, category: string, radiusM: number, notes: string, confidence?: number }>}
 */
export async function analyzePhotoRiskWithGemini({ base64, mimeType = 'image/jpeg', lat, lng }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API anahtarı gerekli (frontend/.env).');
  }

  const locHint =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `Fotoğraf koordinatları: ${lat.toFixed(5)}, ${lng.toFixed(5)}.`
      : 'Konum bilinmiyor.';

  const res = await fetch(
    `${API_BASE}/${PRIMARY_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `Afet fotoğraf analisti. Türkçe. Sadece JSON.
Kategoriler: "enkaz_olabilir" | "yol_kapali" | "riskli_bolge" | "guvenli".
riskli=true ise ambulans bu noktadan kaçınmalı.`,
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: { mimeType, data: base64 },
              },
              {
                text: `${locHint}
Bu deprem/afet fotoğrafını incele. Enkaz, yıkık bina, yol kapanması veya geçiş riski var mı?

Yanıt JSON:
{
  "isRisky": boolean,
  "category": "enkaz_olabilir" | "yol_kapali" | "riskli_bolge" | "guvenli",
  "radiusM": number,
  "confidence": 0-1,
  "notes": "Türkçe 1-2 cümle"
}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data?.error?.message ?? data?.error;
    throw new Error(formatUserMessage(raw) || `Gemini görüntü hatası (${res.status})`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini görüntü yanıtı alınamadı.');

  const parsed = parseJsonFromGemini(text);
  const category = String(parsed.category || 'guvenli');
  const isRisky = Boolean(parsed.isRisky) && category !== 'guvenli';
  const defaultRadius =
    category === 'enkaz_olabilir' ? 70 : category === 'yol_kapali' ? 55 : 45;

  return {
    isRisky,
    category,
    radiusM: Math.min(90, Math.max(25, Number(parsed.radiusM) || defaultRadius)),
    confidence: parsed.confidence,
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
  };
}

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('Dosya okunamadı'));
        return;
      }
      const base64 = dataUrl.split(',')[1];
      resolve({
        base64,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}
