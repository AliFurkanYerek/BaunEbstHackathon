/**
 * Hasar fotoğrafı konumu: EXIF GPS, yoksa GeoSeer — backend (/api/photo-geolocate).
 */

import { formatUserMessage } from './formatUserMessage.js';

const API_BASE = import.meta.env.VITE_INFERENCE_API_URL || '';

/**
 * @param {File} file
 */
export async function geolocatePhoto(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE}/api/photo-geolocate`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok && data.status === 'success' && Array.isArray(data.locations) && data.locations.length > 0) {
    return data;
  }

  let fallback = formatUserMessage(data.error) || `Konum isteği başarısız (${res.status})`;
  if (res.status === 404) {
    fallback =
      'Sunucuda /api/photo-geolocate bulunamadı (404). Muhtemelen eski Flask süreci çalışıyor: analiz terminalinde Ctrl+C, sonra proje kökünde «npm run api» ile yeniden başlatın. Konsolda «GeoSeer foto konum: etkin» yazmalı.';
  }

  return {
    status: data.status || 'error',
    error: fallback,
    ...data,
  };
}
