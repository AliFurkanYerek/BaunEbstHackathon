/**
 * Açık OSRM — yürüyüş rotası (GeoJSON koordinatları Leaflet [lat,lng]).
 * https://project-osrm.org/
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

/**
 * @param {{ lat: number; lng: number }} from
 * @param {{ lat: number; lng: number }} to
 * @returns {Promise<{ positions: [number, number][]; distanceM: number; durationS: number; source: 'osrm' }>}
 */
export async function fetchWalkingRoute(from, to) {
  const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(data.message || `Rota alınamadı (HTTP ${res.status})`);
  }

  const route = data.routes[0];
  const positions = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  return {
    positions,
    distanceM: route.distance,
    durationS: route.duration,
    source: 'osrm',
  };
}

/** OSRM başarısız olursa kuş uçuşu çizgi (tahmini). */
export function straightLineRoute(from, to) {
  const distM = haversineM(from.lat, from.lng, to.lat, to.lng);
  return {
    positions: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceM: distM,
    durationS: distM / 1.2,
    source: 'straight',
  };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatRouteSummary(distanceM, durationS) {
  const km = distanceM / 1000;
  const kmStr = km < 1 ? `${Math.round(distanceM)} m` : `${km.toFixed(1)} km`;
  const min = Math.max(1, Math.round(durationS / 60));
  return `≈ ${kmStr} · ${min} dk yürüyüş (tahmini)`;
}
