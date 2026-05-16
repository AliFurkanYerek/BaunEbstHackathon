/**
 * 4 OSRM aday rotası — kullanıcı bildirimine (15 m) değen yollar elenir.
 */
import {
  closestRoutePointToHazard,
  isIncidentHazard,
  USER_REPORT_AVOID_RADIUS_M,
} from './hazardZones.js';
import { bearingDeg, offsetPointM } from './riskGeometry.js';
import { fetchDrivingRoute, fetchDrivingRouteAlternatives } from './osrmRoute.js';

const TARGET_CANDIDATES = 4;
const VIA_OFFSET_M = 380;

function routeKey(route) {
  const p = route.positions;
  if (!p?.length) return '';
  const a = p[0];
  const b = p[p.length - 1];
  const mid = p[Math.floor(p.length / 2)];
  return `${Math.round(route.distanceM)}_${a[0].toFixed(4)}_${mid[0].toFixed(4)}_${b[0].toFixed(4)}`;
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const out = [];
  for (const r of routes) {
    if (!r?.positions?.length) continue;
    const k = routeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Olay yerindeki bildirim hariç kullanıcı binaları. */
export function userReportsForRouteCheck(buildings, incident) {
  return (buildings || []).filter((b) => {
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return false;
    const h = { lat: b.lat, lng: b.lng, kind: 'user', buildingId: b.id };
    return !isIncidentHazard(h, incident);
  });
}

/**
 * Rota üzerinde veya bildirime ≤ marginM yakın mı?
 * @returns {{ building, distM } | null}
 */
export function findUserReportOnRoute(positions, buildings, incident, marginM = USER_REPORT_AVOID_RADIUS_M) {
  if (!positions?.length) return null;
  const reports = userReportsForRouteCheck(buildings, incident);
  for (const b of reports) {
    const hazard = { lat: b.lat, lng: b.lng, radiusM: marginM, kind: 'user', buildingId: b.id };
    const { distM } = closestRoutePointToHazard(positions, hazard);
    if (distM <= marginM) {
      return { building: b, distM: Math.round(distM) };
    }
  }
  return null;
}

export function scoreRouteCandidate(route, buildings, incident, marginM = USER_REPORT_AVOID_RADIUS_M) {
  const conflict = findUserReportOnRoute(route.positions, buildings, incident, marginM);
  return {
    route,
    safe: !conflict,
    conflict,
    distanceM: route.distanceM,
    durationS: route.durationS,
  };
}

/** OSRM alternatifleri + gerekirse ara noktalı ek yollar (toplam 4). */
export async function fetchFourDrivingCandidates(from, to) {
  const collected = [];

  try {
    const alts = await fetchDrivingRouteAlternatives(from, to, []);
    const list = Array.isArray(alts) ? alts : [alts];
    collected.push(...list);
  } catch {
    /* devam */
  }

  if (!collected.length) {
    const single = await fetchDrivingRoute(from, to, []);
    collected.push(single);
  }

  const br = bearingDeg(from, to);
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  const sideAngles = [90, 270, 45, 225, 135, 315];

  for (const addDeg of sideAngles) {
    if (dedupeRoutes(collected).length >= TARGET_CANDIDATES) break;
    const wp = offsetPointM(midLat, midLng, (br + addDeg) % 360, VIA_OFFSET_M);
    try {
      const viaRoute = await fetchDrivingRoute(from, to, [{ lat: wp.lat, lng: wp.lng }]);
      collected.push(viaRoute);
    } catch {
      /* sonraki açı */
    }
  }

  return dedupeRoutes(collected).slice(0, TARGET_CANDIDATES);
}

/**
 * 4 adayı tek tek kontrol et; güvenli olanlar arasından en kısa mesafeyi seç.
 */
export async function pickBestRouteAvoidingUserReports(from, to, buildings, incident) {
  const candidates = await fetchFourDrivingCandidates(from, to);
  if (!candidates.length) {
    throw new Error('OSRM rotası alınamadı.');
  }

  const evaluated = candidates.map((route, index) => ({
    index: index + 1,
    ...scoreRouteCandidate(route, buildings, incident),
  }));

  const safe = evaluated.filter((e) => e.safe);
  const rejected = evaluated.filter((e) => !e.safe);

  if (!safe.length) {
    const names = rejected
      .map((e) => e.conflict?.building?.name || 'bildirim')
      .slice(0, 3)
      .join(', ');
    throw new Error(
      `4 alternatif yolun tamamı kullanıcı bildirimine 15 m içinde kaldı (${names}${rejected.length > 3 ? '…' : ''}). Hedef veya bildirimleri kontrol edin.`
    );
  }

  safe.sort((a, b) => a.distanceM - b.distanceM);
  const best = safe[0];

  const notes = `${candidates.length} yol denendi · ${rejected.length} elendi (15 m kullanıcı bildirimi) · ${safe.length} güvenli · #${best.index} seçildi`;

  return {
    route: best.route,
    evaluated,
    rejectedCount: rejected.length,
    safeCount: safe.length,
    candidateCount: candidates.length,
    routeNotes: notes,
    selectedIndex: best.index,
  };
}
