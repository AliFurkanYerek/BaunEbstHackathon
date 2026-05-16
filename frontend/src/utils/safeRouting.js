/**
 * Güvenli araç rotası — OSRM gerçek yollar + risk bölgelerinden kaçınma.
 * Daire veya polygon risk alanları; en kısa GÜVENLİ rota.
 */
import { fetchDrivingRoute, formatRouteSummary } from './osrmRoute.js';
import {
  collectRoutingBlockers,
  getAvoidanceHazards,
  isIncidentHazard,
} from './hazardZones.js';
import {
  zoneCenter,
  zoneType,
  lineCrossesRiskZone,
  segmentCrossesRiskZone,
  routeCrossesRiskZones,
  isPointInAnyRiskZone,
  bearingDeg,
  offsetPointM,
  haversineM,
  effectiveZoneRadiusM,
} from './riskGeometry.js';

import { createRouteDeadline, ROUTE_TOTAL_BUDGET_MS } from './routeDeadline.js';

export const DEFAULT_SAFETY_MARGIN_M = 8;
export const SAFE_ROUTE_COLOR = '#22c55e';

const MAX_VIA = 10;
const MAX_REFINE = 5;
const MAX_REPAIR_ITER = 5;
const MAX_ZONES = 14;
const MAX_CHAIN_BLOCKERS = 4;

let activeDeadline = null;

/** Hazard → risk zone (güvenlik payı ayrı parametre — çift sayılmaz). */
export function hazardToRiskZone(h) {
  if (h.polygon?.length >= 3 || h.type === 'polygon') {
    return {
      id: h.id || h.buildingId || h.reportId,
      type: 'polygon',
      coordinates: h.coordinates || h.polygon,
      kind: h.kind,
      buildingId: h.buildingId,
      reportId: h.reportId,
    };
  }
  return {
    id: h.id || h.buildingId || h.reportId,
    type: 'circle',
    lat: h.lat,
    lng: h.lng,
    radiusM: h.radiusM ?? 70,
    kind: h.kind,
    buildingId: h.buildingId,
    reportId: h.reportId,
  };
}

export function hazardsToRiskZones(hazards) {
  return (hazards || []).map((h) => hazardToRiskZone(h));
}

export function buildRiskZonesFromProject(photoReports, buildings, extraZones = []) {
  const blockers = collectRoutingBlockers(photoReports, buildings);
  return [
    ...hazardsToRiskZones(blockers),
    ...extraZones.map((z) => ({ safetyMarginM: DEFAULT_SAFETY_MARGIN_M, ...z })),
  ];
}

export function filterExemptDestination(riskZones, destination) {
  if (!destination?.lat) return riskZones;
  return riskZones.filter((z) => {
    const h = {
      lat: zoneType(z) === 'circle' ? z.lat : zoneCenter(z).lat,
      lng: zoneType(z) === 'circle' ? z.lng : zoneCenter(z).lng,
      buildingId: z.buildingId,
      reportId: z.reportId,
      kind: z.kind,
    };
    if (zoneType(z) === 'circle') {
      h.lat = z.lat;
      h.lng = z.lng;
      h.radiusM = z.radiusM;
    }
    return !isIncidentHazard(h, destination);
  });
}

function limitRiskZones(zones, from, to, max = MAX_ZONES) {
  if (!zones?.length || zones.length <= max) return zones || [];
  const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  return [...zones]
    .sort((a, b) => {
      const ca = zoneCenter(a);
      const cb = zoneCenter(b);
      return (
        haversineM(mid.lat, mid.lng, ca.lat, ca.lng) -
        haversineM(mid.lat, mid.lng, cb.lat, cb.lng)
      );
    })
    .slice(0, max);
}

function dedupeVia(list) {
  const out = [];
  for (const w of list) {
    if (!Number.isFinite(w.lat) || !Number.isFinite(w.lng)) continue;
    if (out.some((o) => Math.abs(o.lat - w.lat) < 1e-5 && Math.abs(o.lng - w.lng) < 1e-5)) {
      continue;
    }
    out.push(w);
  }
  return out.slice(0, MAX_VIA);
}

function routeIsSafe(positions, riskZones, safetyMarginM) {
  return !routeCrossesRiskZones(positions, riskZones, safetyMarginM);
}

async function osrmFetchLeg(from, to, via = []) {
  if (activeDeadline?.expired()) return null;
  try {
    return await fetchDrivingRoute(from, to, via);
  } catch {
    return null;
  }
}

/** Güvenli bacak — tek OSRM çağrısı (alternatif yok = hızlı). */
async function osrmSafeLeg(from, to, via, riskZones, safetyMarginM, relax = 0) {
  if (activeDeadline?.expired()) return null;
  const margin = Math.max(2, safetyMarginM - relax * 3);
  const leg = await osrmFetchLeg(from, to, via);
  if (!leg) return relax < 1 ? osrmSafeLeg(from, to, via, riskZones, safetyMarginM, relax + 1) : null;
  if (routeIsSafe(leg.positions, riskZones, margin)) return leg;
  if (relax < 2) return osrmSafeLeg(from, to, via, riskZones, safetyMarginM, relax + 1);
  return null;
}

function getCorridorZones(from, to, riskZones, bufferM, safetyMarginM) {
  const list = riskZones.filter((z) => {
    if (lineCrossesRiskZone(from, to, z, safetyMarginM)) return true;
    const c = zoneCenter(z);
    const dist = haversineM(from.lat, from.lng, c.lat, c.lng);
    const r = effectiveZoneRadiusM(z) + bufferM;
    const distTo = haversineM(to.lat, to.lng, c.lat, c.lng);
    return dist < r + 200 || distTo < r + 200;
  });
  return list.slice(0, MAX_CHAIN_BLOCKERS);
}

function sortZonesAlongPath(from, to, zones) {
  const mainBearing = bearingDeg(from, to);
  return [...zones].sort((a, b) => {
    const ca = zoneCenter(a);
    const cb = zoneCenter(b);
    const da = haversineM(from.lat, from.lng, ca.lat, ca.lng);
    const db = haversineM(from.lat, from.lng, cb.lat, cb.lng);
    const ba = bearingDeg(from, ca);
    const bb = bearingDeg(from, cb);
    const diffA = Math.abs(((ba - mainBearing + 540) % 360) - 180);
    const diffB = Math.abs(((bb - mainBearing + 540) % 360) - 180);
    return da + diffA * 2 - (db + diffB * 2);
  });
}

function detourWaypointsAroundZone(
  zone,
  from,
  to,
  riskZones,
  escalation,
  safetyMarginM,
  force = false
) {
  const c = zoneCenter(zone);
  const radius = effectiveZoneRadiusM(zone);
  const large = radius >= 80;
  const extra = (large ? 100 : 75) + escalation * 55 + radius * (large ? 0.35 : 0.12);
  const clearance = radius + extra + safetyMarginM;
  const routeBearing = bearingDeg(from, to);
  const options = [];
  const sides = force ? 16 : 10;

  for (let side = 0; side < sides; side++) {
    const perp = (routeBearing + side * (360 / sides)) % 360;
    const wps = [
      offsetPointM(c.lat, c.lng, (perp + 180) % 360, clearance * 0.55),
      offsetPointM(c.lat, c.lng, perp, clearance),
      offsetPointM(c.lat, c.lng, (perp + 22) % 360, clearance * 1.1),
    ].map((p) => ({ lat: p.lat, lng: p.lng }));
    if (
      !force &&
      !wps.every((w) => !isPointInAnyRiskZone(w.lat, w.lng, riskZones, safetyMarginM + 1))
    ) {
      continue;
    }
    const score =
      haversineM(from.lat, from.lng, wps[0].lat, wps[0].lng) +
      wps.reduce((s, w) => s + haversineM(w.lat, w.lng, to.lat, to.lng), 0);
    options.push({ wps, score });
  }
  options.sort((a, b) => a.score - b.score);
  if (options[0]?.wps?.length) return options[0].wps;
  if (force) {
    const p = offsetPointM(c.lat, c.lng, (routeBearing + 90) % 360, clearance);
    return [{ lat: p.lat, lng: p.lng }];
  }
  return [];
}

function stitchPositions(acc, legPositions) {
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

async function buildWaypointChainRoute(from, to, riskZones, safetyMarginM, escalation = 0) {
  const blockers = sortZonesAlongPath(
    from,
    to,
    getCorridorZones(from, to, riskZones, 100 + escalation * 45, safetyMarginM)
  );
  if (!blockers.length) {
    return osrmSafeLeg(from, to, [], riskZones, safetyMarginM);
  }

  const chain = [{ lat: from.lat, lng: from.lng }];
  let cursor = from;
  for (const z of blockers) {
    let arc = detourWaypointsAroundZone(z, cursor, to, riskZones, escalation, safetyMarginM);
    if (!arc.length) {
      arc = detourWaypointsAroundZone(z, cursor, to, riskZones, escalation + 2, safetyMarginM, true);
    }
    for (const wp of arc) {
      chain.push(wp);
      cursor = wp;
    }
  }
  chain.push({ lat: to.lat, lng: to.lng });

  let positions = [];
  let distanceM = 0;
  let durationS = 0;

  for (let i = 0; i < chain.length - 1; i++) {
    let leg = await osrmSafeLeg(chain[i], chain[i + 1], [], riskZones, safetyMarginM);
    if (!leg) leg = await osrmSafeLeg(chain[i], chain[i + 1], [], riskZones, safetyMarginM, 2);
    if (!leg) return null;
    positions = stitchPositions(positions, leg.positions);
    distanceM += leg.distanceM;
    durationS += leg.durationS;
  }

  if (!routeIsSafe(positions, riskZones, safetyMarginM)) return null;
  return { positions, distanceM, durationS, source: 'osrm' };
}

async function buildRefinedRoute(from, to, riskZones, safetyMarginM, extraVia = []) {
  let via = dedupeVia(extraVia);
  let leg = await osrmSafeLeg(from, to, via, riskZones, safetyMarginM);
  if (!leg) leg = await buildWaypointChainRoute(from, to, riskZones, safetyMarginM, 0);
  if (!leg) return null;

  for (let pass = 0; pass < MAX_REFINE; pass++) {
    if (routeIsSafe(leg.positions, riskZones, safetyMarginM)) break;
    const crossing = riskZones.filter((z) =>
      lineCrossesRiskZone(from, to, z, safetyMarginM)
    );
    const esc = Math.min(5, Math.floor(pass / 4));
    for (const z of crossing) {
      via.push(...detourWaypointsAroundZone(z, from, to, riskZones, esc, safetyMarginM));
    }
    via = dedupeVia(via);
    const next = await osrmSafeLeg(from, to, via, riskZones, safetyMarginM);
    if (next) leg = next;
    else break;
  }
  if (!leg) return null;
  return {
    ...leg,
    source: via.length ? 'osrm+gemini' : leg.source || 'osrm',
  };
}

/** Gemini ara noktaları — risk içindekiler atılır, yol yönüne göre sıralanır. */
export function sanitizeGeminiWaypoints(waypoints, from, to, riskZones, safetyMarginM) {
  const sorted = [...(waypoints || [])]
    .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lng))
    .sort(
      (a, b) =>
        haversineM(from.lat, from.lng, a.lat, a.lng) -
        haversineM(from.lat, from.lng, b.lat, b.lng)
    )
    .filter((w) => !isPointInAnyRiskZone(w.lat, w.lng, riskZones, safetyMarginM));
  return dedupeVia(sorted);
}

function zonesCrossedByRoute(positions, riskZones, safetyMarginM) {
  return riskZones.filter((z) => {
    for (let i = 0; i < positions.length - 1; i++) {
      const [a0, a1] = positions[i];
      const [b0, b1] = positions[i + 1];
      if (segmentCrossesRiskZone(a0, a1, b0, b1, z, safetyMarginM)) return true;
    }
    return false;
  });
}

/** OSRM rotası kırmızı kesiyorsa ara nokta ekleyerek düzelt. */
async function repairRouteIteratively(from, to, riskZones, safetyMarginM, seedVia = []) {
  let via = dedupeVia(seedVia);

  for (let iter = 0; iter < MAX_REPAIR_ITER; iter++) {
    if (activeDeadline?.expired()) return null;

    const leg = await osrmFetchLeg(from, to, via);
    if (!leg?.positions?.length) return null;

    if (routeIsSafe(leg.positions, riskZones, safetyMarginM)) {
      return {
        ...leg,
        source: via.length ? 'osrm+gemini' : 'osrm',
      };
    }

    const crossed = zonesCrossedByRoute(leg.positions, riskZones, safetyMarginM);
    if (!crossed.length) return null;

    const z = crossed[0];
    let arc = detourWaypointsAroundZone(z, from, to, riskZones, iter, safetyMarginM, true);
    if (!arc.length) {
      const c = zoneCenter(z);
      const pushR = effectiveZoneRadiusM(z) + 100;
      const br = bearingDeg(from, to);
      arc = [offsetPointM(c.lat, c.lng, (br + 90) % 360, pushR)].map((p) => ({
        lat: p.lat,
        lng: p.lng,
      }));
    }
    via.push(...arc.slice(0, 2));
    via = dedupeVia(via);
  }
  return null;
}

/** Hastane → Gemini noktaları → olay (her bacak OSRM + güvenlik kontrolü). */
async function buildGeminiChainRoute(from, to, riskZones, safetyMarginM, geminiVia) {
  if (!geminiVia?.length) return null;
  const chain = [from, ...geminiVia, to];
  let positions = [];
  let distanceM = 0;
  let durationS = 0;

  for (let i = 0; i < chain.length - 1; i++) {
    const leg = await osrmSafeLeg(chain[i], chain[i + 1], [], riskZones, safetyMarginM);
    if (!leg) return null;
    positions = stitchPositions(positions, leg.positions);
    distanceM += leg.distanceM;
    durationS += leg.durationS;
  }

  if (!routeIsSafe(positions, riskZones, safetyMarginM)) return null;
  return { positions, distanceM, durationS, source: 'osrm+gemini' };
}

async function runUntilFound(strategies, riskZones, safetyMarginM) {
  for (const run of strategies) {
    if (activeDeadline?.expired()) break;
    const r = await run();
    if (r?.positions?.length && routeIsSafe(r.positions, riskZones, safetyMarginM)) {
      return r;
    }
  }
  return null;
}

async function computeBestSafeRoute(from, to, riskZones, safetyMarginM, geminiVia = []) {
  const zones = limitRiskZones(riskZones, from, to);
  const safeGemini = sanitizeGeminiWaypoints(geminiVia, from, to, zones, safetyMarginM);

  const strategies = [
    () => repairRouteIteratively(from, to, zones, safetyMarginM, safeGemini),
    () => repairRouteIteratively(from, to, zones, safetyMarginM, []),
    () => buildRefinedRoute(from, to, zones, safetyMarginM, safeGemini.slice(0, 4)),
    () => buildWaypointChainRoute(from, to, zones, safetyMarginM, 0),
  ];

  let best = await runUntilFound(strategies, zones, safetyMarginM);
  if (best) return best;

  if (zones.length > 5) {
    const major = zones.filter(
      (z) => z.kind === 'collapsed' || z.kind === 'photo' || (z.radiusM ?? 0) >= 45
    );
    if (major.length && major.length < zones.length) {
      best = await runUntilFound(
        [() => repairRouteIteratively(from, to, major, safetyMarginM, safeGemini)],
        major,
        safetyMarginM
      );
    }
  }

  return best;
}

/**
 * Ana API — ambulans / itfaiye / ekip aracı.
 * @param {Object} opts
 * @param {{ lat, lng, name? }} opts.from
 * @param {{ lat, lng, name?, id?, kind? }} opts.to
 * @param {Array} opts.riskZones — circle veya polygon
 * @param {number} [opts.safetyMarginM]
 * @param {string} [opts.vehicle] — 'ambulance' | 'fire' | 'rescue'
 */
export async function computeSafeVehicleRoute({
  from,
  to,
  riskZones = [],
  safetyMarginM = DEFAULT_SAFETY_MARGIN_M,
  vehicle = 'ambulance',
  color = SAFE_ROUTE_COLOR,
  geminiWaypoints = [],
}) {
  if (!Number.isFinite(from?.lat) || !Number.isFinite(to?.lat)) {
    throw new Error('Başlangıç veya hedef koordinatı geçersiz.');
  }

  activeDeadline = createRouteDeadline(ROUTE_TOTAL_BUDGET_MS);
  try {
    const avoidZones = limitRiskZones(filterExemptDestination(riskZones, to), from, to);
    const geminiVia = sanitizeGeminiWaypoints(
      geminiWaypoints,
      from,
      to,
      avoidZones,
      safetyMarginM
    );
    let raw = await computeBestSafeRoute(from, to, avoidZones, safetyMarginM, geminiVia);

    if (!raw) {
      if (activeDeadline.expired()) {
        throw new Error('Rota hesabı zaman aşımına uğradı (≈28 sn). Tekrar deneyin.');
      }
      throw new Error(
        'Güvenli rota bulunamadı. Risk alanları çok geniş olabilir; alternatif başlangıç veya engel kontrolü yapın.'
      );
    }

    return finishSafeRoute(raw, {
      from,
      to,
      avoidZones,
      safetyMarginM,
      vehicle,
      color,
      geminiVia,
    });
  } finally {
    activeDeadline = null;
  }
}

function finishSafeRoute(raw, { from, to, avoidZones, safetyMarginM, vehicle, color, geminiVia }) {

  if (!routeIsSafe(raw.positions, avoidZones, safetyMarginM)) {
    throw new Error('Rota risk bölgesinden geçiyor; hesaplama reddedildi.');
  }

  const usedGemini = Boolean(geminiVia?.length && raw.source?.includes('gemini'));
  const labels = {
    ambulance: usedGemini
      ? 'Ambulans — Gemini + OSRM güvenli rota'
      : 'Ambulans — en kısa güvenli rota',
    fire: usedGemini ? 'İtfaiye — Gemini + OSRM' : 'İtfaiye — güvenli rota',
    rescue: usedGemini ? 'Kurtarma — Gemini + OSRM' : 'Kurtarma — güvenli rota',
  };

  const route = {
    id: `safe-${vehicle}`,
    positions: raw.positions,
    distanceM: raw.distanceM,
    durationS: raw.durationS,
    source: raw.source || 'osrm',
    color,
    routeKind: vehicle,
    label: labels[vehicle] || 'Güvenli rota',
    from,
    to,
    summary: formatRouteSummary(raw.distanceM, raw.durationS, 'driving'),
    isEstimate: false,
    weight: 6,
    opacity: 0.95,
    showEndpoints: true,
  };

  return {
    ok: true,
    route,
    routes: [route],
    primaryRoute: route,
    positions: raw.positions,
    distanceM: raw.distanceM,
    durationS: raw.durationS,
    riskZones: avoidZones,
    safetyMarginM,
    avoidsRisk: true,
    vehicle,
    geminiWaypoints: geminiVia,
    usedGemini,
  };
}

export { routeCrossesRiskZones, isPointInAnyRiskZone, lineCrossesRiskZone };
