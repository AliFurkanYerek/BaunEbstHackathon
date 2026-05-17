import { wantsRouteToHospital, wantsRouteToSafeZone } from './routeIntent.js';
import { isGeminiQuotaOrRateLimitError } from './formatUserMessage.js';

/** Gemini başarısızken kısa Türkçe yanıt (kota / anahtar yok). */
export function buildLocalChatReply(questionText, context) {
  const q = (questionText || '').toLocaleLowerCase('tr-TR');
  const loc = context.selectedLocation;
  const nearest = context.nearestZone;
  const hospital = context.nearestHospital;

  if (!loc) {
    return 'Önce haritada bulunduğunuz yere tıklayın (mavi pin). Sonra güvenli alan veya hastane rotasını çizebilirim.';
  }

  if (wantsRouteToHospital(questionText) || /hastane/i.test(q)) {
    if (hospital) {
      return `En yakın hastane: ${hospital.name}${hospital.il ? ` (${hospital.il})` : ''}, yaklaşık ${hospital.distanceKm} km. Haritada yürüyüş rotası çiziliyor. Acil durumda 112’yi arayın.`;
    }
    const list = context.hospitalsWithDistance?.[0];
    if (list) {
      return `Yakın hastane: ${list.name}, yaklaşık ${list.distanceKm} km.`;
    }
    return 'Yakın hastane bulunamadı. Harita verisi yüklenene kadar bekleyin veya sayfayı yenileyin.';
  }

  if (wantsRouteToSafeZone(questionText) || /güvenli|toplanma|güvenli alan/i.test(q)) {
    if (nearest) {
      return `En yakın güvenli bölge: ${nearest.name}, yaklaşık ${nearest.distanceKm} km. Haritada mor işaretli toplanma alanlarına yürüyüş rotası çiziliyor.`;
    }
    const z = context.safeZonesWithDistance?.[0];
    if (z?.distanceKm != null) {
      return `En yakın toplanma alanı: ${z.name}, yaklaşık ${z.distanceKm} km.`;
    }
    return 'Yakın güvenli bölge bulunamadı. AFAD toplanma verisi yükleniyor olabilir.';
  }

  if (/enkaz|altında|sıkış/i.test(q)) {
    return [
      '1. Hemen 112 ve AFAD (122) arayın.',
      '2. Kendiniz kazmayın; seslenerek konum verin.',
      '3. Gaz kaçağı / yangın riskine dikkat edin.',
      '4. Uygulamadan haritada konumu işaretleyerek bildirim yapın.',
    ].join('\n');
  }

  if (/nerede|en yakın/i.test(q) && nearest) {
    return `En yakın güvenli bölge: ${nearest.name} (yaklaşık ${nearest.distanceKm} km). Rota için «Buradan güvenli alana nasıl gidebilirim?» düğmesine basın.`;
  }

  return '';
}

export function getGeminiErrorHint(message) {
  const text = String(message || '');
  if (isGeminiQuotaOrRateLimitError(text)) {
    return 'Bu modelin günlük kotası doldu; yerel yanıt gösterildi. .env içinde VITE_GEMINI_MODEL=gemini-2.5-flash-lite kullanın ve npm run dev’i yeniden başlatın.';
  }
  if (/anahtar|api key|API anahtarı/i.test(text)) {
    return 'Gemini API anahtarı gerekli: frontend/.env içine VITE_GEMINI_API_KEY ekleyin veya sohbette ⚙️ ile yapıştırın.';
  }
  return text.length > 200 ? 'Yapay zekâ yanıtı alınamadı; yerel yanıt kullanıldı.' : text;
}
