/**
 * Bina hasar analizi — yalnızca backend üzerinden (API anahtarı frontend'de yok).
 */

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
    if (!res.ok) {
      return {
        ok: false,
        serverUp: false,
        message:
          'Analiz sunucusu yanıt vermedi. inference-api klasöründe: python app.py (port 5000)',
      };
    }
    const data = await res.json();
    if (!data.roboflowConfigured) {
      return {
        ok: false,
        serverUp: true,
        message:
          'Sunucu çalışıyor. inference-api/.env dosyasına geçerli ROBOFLOW_API_KEY yazın, app.py\'yi yeniden başlatın.',
        ...data,
      };
    }
    return {
      ok: true,
      serverUp: true,
      message:
        Array.isArray(data.modelIds) && data.modelIds.length > 1
          ? `Roboflow hazır · ${data.modelIds.length} model birleşimi (${data.modelIds.join(', ')})`
          : `Roboflow hazır · model: ${data.modelId || data.modelIds?.[0] || '—'}`,
      ...data,
    };
  } catch {
    return {
      ok: false,
      serverUp: false,
      message:
        'Analiz sunucusuna bağlanılamadı. Yeni terminal: cd inference-api → python app.py — frontend: npm run dev',
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
    throw new Error(data.error || `Analiz hatası (${res.status})`);
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
