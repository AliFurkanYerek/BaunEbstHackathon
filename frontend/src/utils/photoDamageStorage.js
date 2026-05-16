/** Yetkili panel — fotoğraf analizi + konum kayıtları (localStorage). */

export const PHOTO_REPORTS_KEY = 'afetKoordinasyonAI_photoDamageReports';

export function loadPhotoReports() {
  try {
    const raw = localStorage.getItem(PHOTO_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePhotoReports(reports) {
  localStorage.setItem(PHOTO_REPORTS_KEY, JSON.stringify(reports));
}

/**
 * @param {{ fileName?: string; analysis: object; geo: { lat: number; lng: number; address?: string; confidence?: number; source?: string } }} payload
 */
export function createPhotoReport(payload) {
  const summary = payload.analysis?.summary ?? {};
  const collapsed = Number(summary.collapsed) || 0;
  const intact = Number(summary.intact) || 0;
  const total = Number(summary.total) || payload.analysis?.detections?.length || 0;

  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    fileName: payload.fileName || 'foto.jpg',
    lat: payload.geo.lat,
    lng: payload.geo.lng,
    address: payload.geo.address || '',
    geoConfidence: payload.geo.confidence,
    geoSource: payload.geo.source || '',
    collapsed,
    intact,
    totalDetections: total,
    suggestedDamageLevel: payload.analysis?.suggestedDamageLevel ?? 2,
    detections: payload.analysis?.detections ?? [],
    analysisMessage: payload.analysis?.message || '',
  };
}
