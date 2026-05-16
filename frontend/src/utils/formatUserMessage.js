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
