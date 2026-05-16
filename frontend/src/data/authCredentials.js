/** Demo giriş bilgileri — üretimde sunucu tabanlı kimlik doğrulama kullanın. */
export const AUTH_STORAGE_KEY = 'afetKoordinasyonAI_session';

export const LOGIN_HINTS = {
  user: { username: 'kullanici', password: 'afet123', label: 'Kullanıcı' },
  authority: { username: 'yetkili', password: 'afet123', label: 'Yetkili' },
};

export function validateLogin(role, username, password) {
  const expected = LOGIN_HINTS[role];
  if (!expected) return false;
  return (
    String(username).trim().toLowerCase() === expected.username &&
    String(password) === expected.password
  );
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s?.role && s?.username) return s;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveSession(session) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
