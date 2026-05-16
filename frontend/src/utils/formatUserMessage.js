/**
 * API veya beklenmedik throw değerlerini JSX'te güvenle göstermek için metne çevirir.
 * Örn. { code, message } nesneleri doğrudan render edilince React hata verir.
 */
export function formatUserMessage(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => formatUserMessage(item))
      .filter(Boolean)
      .join(' · ');
  }
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.msg === 'string') return value.msg;
    if (typeof value.detail === 'string') return value.detail;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Gemini kota / rate-limit — kullanıcıya ham API metni gösterme. */
export function isGeminiQuotaOrRateLimitError(message) {
  const text = formatUserMessage(message).toLowerCase();
  if (!text) return false;
  return (
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('rate-limit') ||
    text.includes('exceeded') ||
    text.includes('generativelanguage.googleapis.com') ||
    text.includes('ai.dev/rate-limit')
  );
}

/** Gemini hatalarını arayüzde gösterilebilir metne çevirir; kota aşımında boş döner. */
export function sanitizeGeminiDisplayMessage(value) {
  const text = formatUserMessage(value);
  if (!text || isGeminiQuotaOrRateLimitError(text)) return '';
  return text;
}
