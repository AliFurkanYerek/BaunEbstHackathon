import {
  haversineM,
  isPointInRiskZone,
  segmentCrossesRiskZone,
  routeCrossesRiskZones,
  lineCrossesRiskZone as geomLineCrosses,
  bearingDeg,
  offsetPointM,
  zoneCenter,
  effectiveZoneRadiusM,
} from './riskGeometry.js';

function hazardAsZone(h) {
  if (h?.polygon?.length >= 3 || h?.type === 'polygon') {
    return {
      type: 'polygon',
      coordinates: h.coordinates || h.polygon,
      lat: h.lat,
      lng: h.lng,
      radiusM: h.radiusM,
    };
  }
  return { type: 'circle', lat: h.lat, lng: h.lng, radiusM: h.radiusM ?? COLLAPSED_AVOID_RADIUS_M };
}

/** Yıkık / enkaz — kaçınma yarıçapı (m). */
export const COLLAPSED_AVOID_RADIUS_M = 70;
/** Kullanıcı bildirimi / sarı pin — kaçınma yarıçapı (m), kesikli daire. */
export const USER_REPORT_AVOID_RADIUS_M = 15;
export const PHOTO_AVOID_RADIUS_M = 45;
/** Yan sokak / ana yol dolanımı ek mesafe (m). */
export const USER_BYPASS_EXTRA_M = 100;
export const COLLAPSED_BYPASS_EXTRA_M = 90;
/** Rota kontrol payı (m) — yol kapalı tamponu. */
export const ROUTE_HAZARD_MARGIN_M = 6;
/** Rota hesabında tek daire üst sınırı (çok geniş = hiç rota yok). */
export const ROUTING_MAX_BLOCK_RADIUS_M = 88;
/** Haritadaki risk ısı — rota için üst sınırlı. */
export function riskHeatRadiusM(riskScore) {
  if (riskScore >= 200) return Math.min(ROUTING_MAX_BLOCK_RADIUS_M, 60 + riskScore / 5);
  if (riskScore >= 150) return Math.min(70, 45 + riskScore / 10);
  return 0;
}

function capRoutingRadiusM(r) {
  return Math.min(ROUTING_MAX_BLOCK_RADIUS_M, Math.max(0, r ?? 0));
}

/** Yakın engelleri birleştir — binlerce üst üste daire rotayı kilitler. */
export function mergeRoutingHazards(hazards, mergeWithinM = 40) {
  const merged = [];
  for (const h of hazards || []) {
    if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) continue;
    const r = capRoutingRadiusM(h.radiusM ?? COLLAPSED_AVOID_RADIUS_M);
    const hit = merged.find(
      (m) => haversineM(m.lat, m.lng, h.lat, h.lng) < mergeWithinM
    );
    if (hit) {
      hit.radiusM = Math.max(hit.radiusM, r);
      if (h.kind === 'collapsed') hit.kind = 'collapsed';
    } else {
      merged.push({ ...h, radiusM: r });
    }
  }
  return merged;
}
/** Sadece aynı bildirim (id) muaf; yakındaki diğer sarılar kaçınılır. */
export const INCIDENT_POSITION_TOLERANCE_M = 4;

export { haversineM };

export function collectAllRouteHazards(photoReports, buildings) {
  const hazards = [];
  for (const report of photoReports || []) {
    if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) continue;
    const collapsed =
      Number(report.collapsed) ||
      (report.detections || []).filter((d) => d.type === 'collapsed').length;
    hazards.push({
      lat: report.lat,
      lng: report.lng,
      radiusM: collapsed >= 1 ? COLLAPSED_AVOID_RADIUS_M : PHOTO_AVOID_RADIUS_M,
      kind: collapsed >= 1 ? 'collapsed' : 'photo',
      reportId: report.id,
    });
  }
  for (const b of buildings || []) {
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue;
    hazards.push({
      lat: b.lat,
      lng: b.lng,
      radiusM: USER_REPORT_AVOID_RADIUS_M,
      kind: 'user',
      buildingId: b.id,
    });
  }
  return hazards;
}

/**
 * Rota için engelli bölge — haritada gördüğünüz büyük kırmızı dahil (yol kapalı).
 * Görüntü: collectAllRouteHazards (ince kesikli sarı 15 m).
 */
export function collectRoutingBlockers(photoReports, buildings) {
  const hazards = collectAllRouteHazards(photoReports, buildings).map((h) => ({ ...h }));

  for (const b of buildings || []) {
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue;
    const heatR = riskHeatRadiusM(b.riskScore ?? 0);
    const existing = hazards.find((h) => h.buildingId === b.id);
    if (existing) {
      existing.radiusM = Math.max(existing.radiusM, USER_REPORT_AVOID_RADIUS_M, heatR);
    } else if (heatR > 0) {
      hazards.push({
        lat: b.lat,
        lng: b.lng,
        radiusM: heatR,
        kind: 'blocked',
        buildingId: b.id,
      });
    }
  }

  for (const h of hazards) {
    if (h.kind === 'collapsed' || h.kind === 'photo') {
      h.radiusM = capRoutingRadiusM(Math.max(h.radiusM, COLLAPSED_AVOID_RADIUS_M));
    } else {
      h.radiusM = capRoutingRadiusM(h.radiusM);
    }
  }

  return mergeRoutingHazards(hazards);
}

/** Seçilen olay bildirimi mi? (yalnızca bu kırmızıya girilebilir) */
export function isIncidentHazard(h, incident) {
  if (!incident?.lat || !h) return false;
  if (incident.id) {
    if (h.buildingId && h.buildingId === incident.id) return true;
    if (h.reportId && h.reportId === incident.id) return true;
  }
  const sameSpot =
    haversineM(h.lat, h.lng, incident.lat, incident.lng) < INCIDENT_POSITION_TOLERANCE_M;
  if (!sameSpot) return false;
  if (incident.kind === 'user' && h.kind === 'user') return true;
  if (incident.kind === 'photo' && (h.kind === 'photo' || h.kind === 'collapsed')) {
    return true;
  }
  if (
    (incident.kind === 'custom' || incident.id === 'custom-dest') &&
    sameSpot
  ) {
    return true;
  }
  return sameSpot && !h.buildingId && !h.reportId;
}

/** Olay yerinin kendi kırmızısı hariç — diğer sarı/kırmızı dairelere girme. */
export function getAvoidanceHazards(allHazards, incident) {
  if (!incident?.lat) return allHazards || [];
  return (allHazards || []).filter((h) => !isIncidentHazard(h, incident));
}

export function isInsideHazard(lat, lng, hazard, marginM = 0) {
  return isPointInRiskZone(lat, lng, hazardAsZone(hazard), marginM);
}

export function isInsideAnyHazard(lat, lng, hazards, marginM = ROUTE_HAZARD_MARGIN_M) {
  if (!hazards?.length) return false;
  return hazards.some((h) => isInsideHazard(lat, lng, h, marginM));
}

export function densifyRoutePositions(positions, stepM = 8) {
  if (!positions?.length) return [];
  if (positions.length === 1) return [[positions[0][0], positions[0][1]]];
  const out = [[positions[0][0], positions[0][1]]];
  for (let i = 0; i < positions.length - 1; i++) {
    const [lat1, lng1] = positions[i];
    const [lat2, lng2] = positions[i + 1];
    const segM = haversineM(lat1, lng1, lat2, lng2);
    const steps = Math.max(1, Math.ceil(segM / stepM));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
    }
  }
  return out;
}

/** Kuş uçuşu veya rota kırmızıya değiyor mu? */
export function segmentCrossesAvoidance(aLat, aLng, bLat, bLng, avoidHazards) {
  if (!avoidHazards?.length) return false;
  const margin = ROUTE_HAZARD_MARGIN_M;
  return avoidHazards.some((h) =>
    segmentCrossesRiskZone(aLat, aLng, bLat, bLng, hazardAsZone(h), margin)
  );
}

export function routeViolatesAvoidance(positions, avoidHazards) {
  if (!avoidHazards?.length || !positions?.length) return false;
  const zones = avoidHazards.map(hazardAsZone);
  return routeCrossesRiskZones(positions, zones, ROUTE_HAZARD_MARGIN_M);
}

export { bearingDeg, offsetPointM };

function closestPointOnSegment(a, b, p) {
  const ax = a[1];
  const ay = a[0];
  const bx = b[1];
  const by = b[0];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return { lat: ay, lng: ax };
  let t = ((p.lng - ax) * dx + (p.lat - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { lat: ay + t * dy, lng: ax + t * dx };
}

export function closestRoutePointToHazard(positions, hazard) {
  let best = { distM: Infinity };
  for (let i = 0; i < positions.length - 1; i++) {
    const cp = closestPointOnSegment(positions[i], positions[i + 1], hazard);
    const distM = haversineM(hazard.lat, hazard.lng, cp.lat, cp.lng);
    if (distM < best.distM) best = { distM, lat: cp.lat, lng: cp.lng };
  }
  return best;
}

/** Doğrudan çizgi bu tehlikeyi kesiyor mu? */
export function lineCrossesHazard(from, to, hazard) {
  return geomLineCrosses(from, to, hazardAsZone(hazard), ROUTE_HAZARD_MARGIN_M);
}

export function getBlockingHazards(from, to, avoidHazards) {
  return (avoidHazards || []).filter((h) => lineCrossesHazard(from, to, h));
}

/**
 * Doğrudan çizgi üstünde veya OSRM'in muhtemelen kırmızıya gireceği koridor.
 * (Sizin tarif ettiğiniz gibi: ana yol + ara sokakla etrafından dolan.)
 */
export function getCorridorHazards(from, to, avoidHazards, corridorBufferM = 120) {
  if (!avoidHazards?.length) return [];
  return avoidHazards.filter((h) => {
    if (lineCrossesHazard(from, to, h)) return true;
    const cp = closestRoutePointToHazard(
      [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      h
    );
    const gap = cp.distM - (h.radiusM ?? COLLAPSED_AVOID_RADIUS_M);
    return gap < corridorBufferM;
  });
}

export function sortHazardsAlongPath(from, to, hazards) {
  const mainBearing = bearingDeg(from, to);
  return [...hazards].sort((a, b) => {
    const da = haversineM(from.lat, from.lng, a.lat, a.lng);
    const db = haversineM(from.lat, from.lng, b.lat, b.lng);
    const ba = bearingDeg(from, a);
    const bb = bearingDeg(from, b);
    const diffA = Math.abs(((ba - mainBearing + 540) % 360) - 180);
    const diffB = Math.abs(((bb - mainBearing + 540) % 360) - 180);
    return da + diffA * 2 - (db + diffB * 2);
  });
}

/** Tehlike etrafında yan/ara sokak yayı — OSRM bu noktalardan geçmek zorunda kalır. */
export function detourWaypointsAround(hazard, from, to, avoidHazards, escalation = 0) {
  const z = hazardAsZone(hazard);
  const radius = effectiveZoneRadiusM(z);
  const large = radius >= 80;
  const c = zoneCenter(z);
  const extra =
    (hazard.kind === 'user' && !large
      ? USER_BYPASS_EXTRA_M
      : COLLAPSED_BYPASS_EXTRA_M) +
    escalation * 45 +
    (large ? radius * 0.35 : 0);
  const clearance = radius + extra;
  const routeBearing = bearingDeg(from, to);
  const options = [];

  for (let side = 0; side < 8; side++) {
    const perp = (routeBearing + side * 45) % 360;
    const wps = [
      offsetPointM(c.lat, c.lng, (perp + 180) % 360, clearance * 0.65),
      offsetPointM(c.lat, c.lng, perp, clearance),
      offsetPointM(c.lat, c.lng, (perp + 30) % 360, clearance * 1.05),
      offsetPointM(c.lat, c.lng, (perp + 330) % 360, clearance * 1.05),
    ].map((p) => ({ lat: p.lat, lng: p.lng }));
    if (!wps.every((w) => !isInsideAnyHazard(w.lat, w.lng, avoidHazards, 1))) continue;
    const score =
      haversineM(from.lat, from.lng, wps[0].lat, wps[0].lng) +
      wps.reduce((s, w) => s + haversineM(w.lat, w.lng, to.lat, to.lng), 0);
    options.push({ wps, score });
  }
  options.sort((a, b) => a.score - b.score);
  return options[0]?.wps ?? [];
}

/** Kırmızıya değen noktaları at — ışınlanma / kesik çizgi yok. */
export function clipTransitPositions(positions, avoidHazards) {
  if (!positions?.length) return positions;
  const out = [];
  for (let i = 0; i < positions.length; i++) {
    const [lat, lng] = positions[i];
    if (isInsideAnyHazard(lat, lng, avoidHazards, ROUTE_HAZARD_MARGIN_M)) break;
    if (i > 0) {
      const [p0, p1] = [positions[i - 1], positions[i]];
      if (segmentCrossesAvoidance(p0[0], p0[1], p1[0], p1[1], avoidHazards)) break;
    }
    out.push([lat, lng]);
  }
  return out.length >= 2 ? out : out.length === 1 ? out : [];
}

export function stitchPositions(acc, legPositions) {
  if (!acc.length) return legPositions.map((p) => [...p]);
  const out = acc.map((p) => [...p]);
  const start = legPositions[0];
  const last = out[out.length - 1];
  const same =
    Math.abs(last[0] - start[0]) < 1e-6 && Math.abs(last[1] - start[1]) < 1e-6;
  const slice = same ? legPositions.slice(1) : legPositions;
  for (const p of slice) out.push([...p]);
  return out;
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
  out.push({ lat: last[0], lng: last[1] });
  return out;
}
