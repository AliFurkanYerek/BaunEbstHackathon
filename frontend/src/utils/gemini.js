import { formatUserMessage } from './formatUserMessage.js';

const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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
    ?.slice(0, 40)
    .map(
      (z) =>
        `- ${z.name} (${z.il || 'il yok'}): enlem ${z.lat}, boylam ${z.lng}, kapasite ${z.capacity} kişi`
    )
    .join('\n');

  const allZonesSorted = context.safeZonesWithDistance
    ?.map((z) => `- ${z.name}: ${z.distanceKm} km (${z.lat}, ${z.lng})`)
    .join('\n');

  return `Sen AfetKoordinasyon AI uygulamasının yardımcı asistanısın. Türkçe, sakin ve net konuş.
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
export async function sendGeminiMessage(messages, context = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API anahtarı bulunamadı. frontend/.env dosyasına VITE_GEMINI_API_KEY=... ekleyin veya sohbet ayarlarından girin.'
    );
  }

  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  const res = await fetch(
    `${API_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(context) }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const raw = data?.error?.message ?? data?.error;
    const msg = formatUserMessage(raw) || `Gemini API hatası (${res.status})`;
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Yanıt alınamadı. Lütfen tekrar deneyin.');
  return text.trim();
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
}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API anahtarı gerekli (frontend/.env veya sohbet ayarları).');
  }

  const hazardList = (hazards || []).slice(0, 40).map((h, i) => ({
    id: i + 1,
    lat: Number(h.lat.toFixed(5)),
    lng: Number(h.lng.toFixed(5)),
    collapsed: h.collapsed,
    label: h.label,
    address: h.address || '',
    bufferM: avoidRadiusM,
  }));

  const userPrompt = `Yetkili panel — ambulans rota planı.

GÖREV: En yakın hastaneden bildirilen olay noktasına ARAÇ rotası planla.
KURAL: Yıkık bina / enkaz tespit noktalarının merkezine ${avoidRadiusM} metreden DAHA YAKIN yol kullanma.
Mümkün olan en kısa süreli güvenli yolu tercih et; gerekiyorsa 0–4 ara nokta (waypoint) öner.

HASTANE (başlangıç):
${JSON.stringify({ name: hospital.name, lat: hospital.lat, lng: hospital.lng })}

BİLDİRİLEN KONUM (varış):
${JSON.stringify({ name: destination.name, lat: destination.lat, lng: destination.lng, kind: destination.kind })}

YIKIK BİNA TESPİTLERİ (Roboflow — kaçınılacak, ${hazardList.length} adet):
${JSON.stringify(hazardList)}

İLK OSRM ARAÇ ROTASI ÖRNEK NOKTALARI (referans):
${JSON.stringify(routeSample || [])}

Yanıtı YALNIZCA şu JSON olarak ver (başka metin yok):
{
  "waypoints": [{"lat": number, "lng": number, "reason": "kısa Türkçe açıklama"}],
  "notes": "Yetkiliye 2-4 cümle Türkçe özet: hangi yıkık alanlardan kaçınıldı, tahmini güvenlik"
}`;

  const res = await fetch(
    `${API_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `Sen afet koordinasyonunda ambulans rota planlayıcısısın. Koordinatlar WGS84 (lat, lng).
Yıkık bina tespitlerinin ${avoidRadiusM} m yakınından geçen güzergâhları reddet.
Sadece geçerli JSON döndür.`,
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
