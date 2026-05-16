/**
 * Risk bölgeleri — daire ve polygon geometrisi (Leaflet [lat, lng]).
 */

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

/** @returns {'circle'|'polygon'} */
export function zoneType(zone) {
  if (zone?.type === 'polygon' && zone.coordinates?.length >= 3) return 'polygon';
  if (zone?.polygon?.length >= 3) return 'polygon';
  return 'circle';
}

/** Kapalı halka [[lat,lng], ...] */
export function zoneRing(zone) {
  if (zoneType(zone) === 'polygon') {
    const ring = zone.coordinates || zone.polygon;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return ring;
    return [...ring, first];
  }
  return null;
}

export function zoneCenter(zone) {
  if (zoneType(zone) === 'circle') {
    return { lat: zone.lat, lng: zone.lng };
  }
  const ring = zoneRing(zone);
  let lat = 0;
  let lng = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    lat += ring[i][0];
    lng += ring[i][1];
  }
  return { lat: lat / n, lng: lng / n };
}

/** Daireyi polygon'a çevir (yaklaşık engel). */
export function circleToPolygon(lat, lng, radiusM, sides = 20) {
  const R = 6371000;
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const br = (i * 360) / sides;
    const brRad = (br * Math.PI) / 180;
    const dLat = ((radiusM * Math.cos(brRad)) / R) * (180 / Math.PI);
    const dLng =
      ((radiusM * Math.sin(brRad)) / (R * Math.cos((lat * Math.PI) / 180))) *
      (180 / Math.PI);
    ring.push([lat + dLat, lng + dLng]);
  }
  ring.push(ring[0]);
  return ring;
}

export function pointInPolygon(lat, lng, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distPointToSegmentM(pLat, pLng, aLat, aLng, bLat, bLng) {
  const ax = aLng;
  const ay = aLat;
  const bx = bLng;
  const by = bLat;
  const px = pLng;
  const py = pLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) return haversineM(pLat, pLng, aLat, aLng);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cLat = ay + t * dy;
  const cLng = ax + t * dx;
  return haversineM(pLat, pLng, cLat, cLng);
}

export function distanceToPolygonEdgeM(lat, lng, ring) {
  let min = Infinity;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const [aLat, aLng] = ring[i];
    const [bLat, bLng] = ring[i + 1];
    min = Math.min(min, distPointToSegmentM(lat, lng, aLat, aLng, bLat, bLng));
  }
  return min;
}

export function effectiveZoneRadiusM(zone) {
  if (zoneType(zone) === 'circle') {
    return (zone.radiusM ?? 70) + (zone.safetyMarginM ?? 0);
  }
  const c = zoneCenter(zone);
  const ring = zoneRing(zone);
  let maxR = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    maxR = Math.max(maxR, haversineM(c.lat, c.lng, ring[i][0], ring[i][1]));
  }
  return maxR + (zone.safetyMarginM ?? 0);
}

/**
 * Nokta risk bölgesinde mi? (güvenlik mesafesi dahil)
 */
export function isPointInRiskZone(lat, lng, zone, safetyMarginM = 0) {
  const margin = safetyMarginM + (zone.safetyMarginM ?? 0);
  if (zoneType(zone) === 'circle') {
    const r = (zone.radiusM ?? 70) + margin;
    return haversineM(lat, lng, zone.lat, zone.lng) < r;
  }
  const ring = zoneRing(zone);
  if (pointInPolygon(lat, lng, ring)) return true;
  return distanceToPolygonEdgeM(lat, lng, ring) < margin;
}

export function isPointInAnyRiskZone(lat, lng, zones, safetyMarginM = 0) {
  return (zones || []).some((z) => isPointInRiskZone(lat, lng, z, safetyMarginM));
}

function densifySegment(aLat, aLng, bLat, bLng, stepM = 5) {
  const out = [[aLat, aLng]];
  const segM = haversineM(aLat, aLng, bLat, bLng);
  const steps = Math.max(1, Math.ceil(segM / stepM));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    out.push([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t]);
  }
  return out;
}

export function segmentCrossesRiskZone(aLat, aLng, bLat, bLng, zone, safetyMarginM = 0) {
  const samples = densifySegment(aLat, aLng, bLat, bLng, 4);
  for (const [lat, lng] of samples) {
    if (isPointInRiskZone(lat, lng, zone, safetyMarginM)) return true;
  }
  return false;
}

export function segmentCrossesAnyRiskZone(aLat, aLng, bLat, bLng, zones, safetyMarginM = 0) {
  return (zones || []).some((z) => segmentCrossesRiskZone(aLat, aLng, bLat, bLng, z, safetyMarginM));
}

export function routeCrossesRiskZones(positions, zones, safetyMarginM = 0) {
  if (!zones?.length || !positions?.length) return false;
  for (let i = 0; i < positions.length - 1; i++) {
    const [a0, a1] = positions[i];
    const [b0, b1] = positions[i + 1];
    if (segmentCrossesAnyRiskZone(a0, a1, b0, b1, zones, safetyMarginM)) return true;
  }
  for (const [lat, lng] of positions) {
    if (isPointInAnyRiskZone(lat, lng, zones, safetyMarginM)) return true;
  }
  return false;
}

export function lineCrossesRiskZone(from, to, zone, safetyMarginM = 0) {
  return segmentCrossesRiskZone(from.lat, from.lng, to.lat, to.lng, zone, safetyMarginM);
}

export function bearingDeg(from, to) {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function offsetPointM(lat, lng, bearing, distanceM) {
  const R = 6371000;
  const br = (bearing * Math.PI) / 180;
  const dLat = ((distanceM * Math.cos(br)) / R) * (180 / Math.PI);
  const dLng =
    ((distanceM * Math.sin(br)) / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}
