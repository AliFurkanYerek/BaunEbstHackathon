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

SORU REHBERİ:
- "En yakın güvenli alan nerede?" → En yakın bölgeyi ad ve mesafe ile söyle; haritada mor kare olduğunu belirt.
- "Buradan güvenli alana nasıl gidebilirim?" → Yürüyüş güvenliyse yön tarifi ver; yıkık bina/enkaz varsa uzak dur, alternatif güvenli bölge öner; araç kullanma konusunda dikkatli ol.
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
    const msg =
      data?.error?.message ||
      `Gemini API hatası (${res.status})`;
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Yanıt alınamadı. Lütfen tekrar deneyin.');
  return text.trim();
}
