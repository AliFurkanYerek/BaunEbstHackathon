/**
 * Bina hasar analizi — yalnızca backend üzerinden (API anahtarı frontend'de yok).
 */

import { formatUserMessage } from './formatUserMessage.js';

export function mapClassLabel(className) {
  const c = (className || '').toLowerCase().replace(/ı/g, 'i');
  if (c.includes('saglam') || c.includes('sağlam')) {
    return { type: 'intact', label: 'Sağlam bina', color: '#22c55e', damageLevel: 2 };
  }
  if (c.includes('yikik') || c.includes('yıkık') || c.includes('collapsed')) {
    return { type: 'collapsed', label: 'Yıkık bina', color: '#ef4444', damageLevel: 5 };
  }
  return { type: 'unknown', label: className || 'Bilinmiyor', color: '#94a3b8', damageLevel: 3 };
}

const API_BASE = import.meta.env.VITE_INFERENCE_API_URL || '';

/** Backend sağlık kontrolü */
export async function checkInferenceBackend() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const proxyDead = res.status === 502 || res.status === 503 || res.status === 504;
      const detail = formatUserMessage(data.error || data.message || '');
      const suffix = detail ? ` ${detail}` : '';
      return {
        ok: false,
        serverUp: false,
        ...data,
        message: proxyDead
          ? `Flask analiz sunucusu kapalı veya erişilemiyor (HTTP ${res.status}). Önce başlatın: proje kökünde veya frontend klasöründe «npm run api» — ya da «cd inference-api» → «python app.py» (port 5000). Ardından «Sunucu durumunu yenile».`
          : `Analiz sunucusu beklenmeyen yanıt verdi (HTTP ${res.status}). inference-api konsolunda hata var mı bakın.${suffix}`,
      };
    }
    if (!data.roboflowConfigured) {
      return {
        ...data,
        ok: false,
        serverUp: true,
        message:
          'Sunucu çalışıyor. inference-api/.env dosyasına geçerli ROBOFLOW_API_KEY yazın, app.py\'yi yeniden başlatın.',
      };
    }
    const hint =
      Array.isArray(data.modelIds) && data.modelIds.length > 1
        ? `Roboflow hazır · ${data.modelIds.length} model birleşimi (${data.modelIds.join(', ')})`
        : `Roboflow hazır · model: ${data.modelId || data.modelIds?.[0] || '—'}`;
    const geoHint =
      data.geoseerConfigured === true
        ? ' · GeoSeer foto konum hazır'
        : data.geoseerConfigured === false
          ? ' · GEOSEER_API_KEY eksik (inference-api/.env)'
          : ' · Foto konum için Flask’ı yeniden başlatın (npm run api)';
    return {
      ...data,
      ok: true,
      serverUp: true,
      photoGeolocateReady: data.geoseerConfigured === true,
      message: hint + geoHint,
    };
  } catch {
    return {
      ok: false,
      serverUp: false,
      message:
        'Analiz sunucusuna bağlanılamadı (CORS/ağ). Frontend klasöründe: npm run api (Flask 5000) + npm run dev; inference-api/.env içinde ROBOFLOW_API_KEY',
    };
  }
}

/**
 * Fotoğrafı backend'e gönderir → sağlam / yıkık tespiti
 * @param {File} file
 */
export async function analyzeImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE}/api/analyze-image`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = formatUserMessage(data.error);
    throw new Error(msg || `Analiz hatası (${res.status})`);
  }

  return data;
}

export function getDatasetUrls() {
  return [
    [
      'earthquake-damage-detection-xmfgr',
      'https://universe.roboflow.com/roads-aihh0/earthquake-damage-detection-xmfgr',
    ],
    [
      'collapsed-building-detection2-ku0yq',
      'https://universe.roboflow.com/new-workspace-jejih/collapsed-building-detection2-ku0yq',
    ],
  ];
}

export function getDatasetUrl() {
  return getDatasetUrls()[0][1];
}
