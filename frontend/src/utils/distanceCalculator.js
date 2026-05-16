export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function findNearestSafeZone(lat, lng, safeZones) {
  if (!safeZones?.length) return null;
  let nearest = null;
  let minDist = Infinity;
  for (const zone of safeZones) {
    const dist = distanceKm(lat, lng, zone.lat, zone.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = { ...zone, distanceKm: Math.round(dist * 100) / 100 };
    }
  }
  return nearest;
}

export function findNearestHospital(lat, lng, hospitals) {
  if (!hospitals?.length) return null;
  let nearest = null;
  let minDist = Infinity;
  for (const h of hospitals) {
    if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) continue;
    const dist = distanceKm(lat, lng, h.lat, h.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = { ...h, distanceKm: Math.round(dist * 100) / 100 };
    }
  }
  return nearest;
}
