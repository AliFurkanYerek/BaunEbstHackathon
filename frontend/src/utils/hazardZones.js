/** Yıkık bina / enkaz — ambulans rotasından kaçınılacak alanlar (metre). */
export const COLLAPSED_AVOID_RADIUS_M = 70;

export function haversineM(lat1, lng1, lat2, lng2) {
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

/**
 * Roboflow fotoğraf analizlerinden yıkık bina konumları.
 * @param {Array<object>} photoReports
 */
export function collectDamageHazards(photoReports) {
  const hazards = [];
  for (const report of photoReports || []) {
    if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) continue;
    const collapsed =
      Number(report.collapsed) ||
      (report.detections || []).filter((d) => d.type === 'collapsed').length;
    if (collapsed < 1) continue;
    hazards.push({
      lat: report.lat,
      lng: report.lng,
      radiusM: COLLAPSED_AVOID_RADIUS_M,
      label: report.fileName || 'Yıkık bina tespiti',
      collapsed,
      reportId: report.id,
      address: report.address || '',
    });
  }
  return hazards;
}

export function distanceToHazardM(lat, lng, hazard) {
  const d = haversineM(lat, lng, hazard.lat, hazard.lng);
  return d - (hazard.radiusM ?? COLLAPSED_AVOID_RADIUS_M);
}

export function routeViolatesHazards(positions, hazards, minClearanceM = 0) {
  if (!hazards?.length || !positions?.length) return false;
  for (const [lat, lng] of positions) {
    for (const h of hazards) {
      if (distanceToHazardM(lat, lng, h) < minClearanceM) return true;
    }
  }
  return false;
}

function bearingDeg(from, to) {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function offsetPointM(lat, lng, bearingDeg, distanceM) {
  const R = 6371000;
  const br = (bearingDeg * Math.PI) / 180;
  const dLat = ((distanceM * Math.cos(br)) / R) * (180 / Math.PI);
  const dLng =
    ((distanceM * Math.sin(br)) / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

function closestPointOnSegment(a, b, p) {
  const ax = a[1];
  const ay = a[0];
  const bx = b[1];
  const by = b[0];
  const px = p.lng;
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return { lat: ay, lng: ax };
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { lat: ay + t * dy, lng: ax + t * dx };
}

/** Rota üzerinde tehlikeye en yakın nokta. */
export function closestRoutePointToHazard(positions, hazard) {
  let best = { distM: Infinity, lat: positions[0][0], lng: positions[0][1] };
  for (let i = 0; i < positions.length - 1; i++) {
    const cp = closestPointOnSegment(positions[i], positions[i + 1], hazard);
    const distM = haversineM(hazard.lat, hazard.lng, cp.lat, cp.lng);
    if (distM < best.distM) best = { distM, lat: cp.lat, lng: cp.lng };
  }
  return best;
}

/**
 * Tek bir yıkık bina için OSRM ara noktası (70 m tampon dışına).
 */
export function bypassWaypointForHazard(hazard, positions) {
  const close = closestRoutePointToHazard(positions, hazard);
  const away = bearingDeg({ lat: close.lat, lng: close.lng }, hazard);
  const pushM = (hazard.radiusM ?? COLLAPSED_AVOID_RADIUS_M) + 45;
  return offsetPointM(hazard.lat, hazard.lng, away, pushM);
}

export function sampleRoutePositions(positions, maxPoints = 24) {
  if (!positions?.length) return [];
  if (positions.length <= maxPoints) return positions.map(([lat, lng]) => ({ lat, lng }));
  const step = Math.max(1, Math.floor(positions.length / maxPoints));
  const out = [];
  for (let i = 0; i < positions.length; i += step) {
    out.push({ lat: positions[i][0], lng: positions[i][1] });
  }
  const last = positions[positions.length - 1];
  const tail = { lat: last[0], lng: last[1] };
  if (out[out.length - 1]?.lat !== tail.lat) out.push(tail);
  return out;
}
