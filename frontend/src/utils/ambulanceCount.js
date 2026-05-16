import { haversineM } from './hazardZones.js';

const NEARBY_RADIUS_M = 600;

/**
 * Bildirilen bölgeye göre önerilen ambulans sayısı.
 */
export function estimateAmbulanceCount({ destination, buildings, photoReports, selectedIncident }) {
  let people = 0;
  let collapsedNearby = 0;
  let reportsNearby = 0;

  if (selectedIncident?.kind === 'user' && selectedIncident.peopleCount) {
    people += Number(selectedIncident.peopleCount) || 1;
  }

  for (const b of buildings || []) {
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue;
    const d = haversineM(b.lat, b.lng, destination.lat, destination.lng);
    if (d > NEARBY_RADIUS_M) continue;
    reportsNearby += 1;
    people += Math.max(1, Number(b.peopleCount) || 1);
    if ((b.damageLevel ?? 0) >= 4) people += 1;
  }

  for (const p of photoReports || []) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const d = haversineM(p.lat, p.lng, destination.lat, destination.lng);
    if (d > NEARBY_RADIUS_M) continue;
    const c = Number(p.collapsed) || 0;
    collapsedNearby += c;
    people += c * 2;
    reportsNearby += 1;
  }

  let count = 1;
  if (people <= 2) count = 1;
  else if (people <= 6) count = 2;
  else if (people <= 14) count = 3;
  else count = Math.min(8, Math.ceil(people / 5));

  if (collapsedNearby >= 5) count = Math.max(count, 3);
  if (reportsNearby >= 4) count = Math.max(count, 2);

  const detail =
    `${people} kişi etkilenen tahmin · ${reportsNearby} yakın bildirim · ${collapsedNearby} yıkık tespiti (600 m içi)`;

  return { count, people, collapsedNearby, reportsNearby, detail };
}
