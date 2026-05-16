/**
 * 30 OSRM aday rotası (ana yol + çoklu ara sokak via).
 * Kullanıcı bildirimine 15 m yakın yollar elenir.
 */
import {
  closestRoutePointToHazard,
  isIncidentHazard,
  USER_REPORT_AVOID_RADIUS_M,
} from './hazardZones.js';
import { bearingDeg, offsetPointM, haversineM } from './riskGeometry.js';
import { fetchDrivingRoute, fetchDrivingRouteAlternatives } from './osrmRoute.js';
import {
  buildResidentialWaypoints,
  EXAMPLE_SOKAK_CHAIN,
  geocodeStreetChain,
} from './streetGeocode.js';

export const TARGET_CANDIDATES = 30;

const BATCH_SIZE = 6;
const MAX_PLANS_TO_TRY = 55;

function routeKey(route) {
  const p = route.positions;
  if (!p?.length) return '';
  const step = Math.max(1, Math.floor(p.length / 8));
  const sig = [];
  for (let i = 0; i < p.length; i += step) {
    sig.push(`${p[i][0].toFixed(4)},${p[i][1].toFixed(4)}`);
  }
  return `${Math.round(route.distanceM)}_${sig.join('|')}`;
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

function pointAlongLine(from, to, fraction) {
  const t = Math.max(0.05, Math.min(0.95, fraction));
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

/**
 * Programatik ara sokak planları — 30 benzersiz rota için yeterli çeşitlilik.
 */
function buildSideStreetViaPlans(from, to) {
  const br = bearingDeg(from, to);
  const plans = [];
  let idx = 0;

  const fractions = [];
  for (let t = 0.12; t <= 0.88; t += 0.04) {
    fractions.push(Math.round(t * 100) / 100);
  }

  const sideAngles = [70, 90, 110, 250, 270, 290];
  const offsetsM = [120, 160, 200, 240, 280, 340, 400];

  for (const t of fractions) {
    for (const side of sideAngles) {
      for (const m of offsetsM) {
        if (plans.length >= MAX_PLANS_TO_TRY) break;
        const anchor = pointAlongLine(from, to, t);
        const wp = offsetPointM(anchor.lat, anchor.lng, (br + side) % 360, m);
        plans.push({
          label: `side-${idx++}`,
          via: [{ lat: wp.lat, lng: wp.lng }],
        });
      }
      if (plans.length >= MAX_PLANS_TO_TRY) break;
    }
    if (plans.length >= MAX_PLANS_TO_TRY) break;
  }

  const diagSides = [35, 55, 125, 145, 215, 235, 305, 325];
  for (const t of [0.22, 0.38, 0.5, 0.62, 0.78]) {
    for (const side of diagSides) {
      if (plans.length >= MAX_PLANS_TO_TRY) break;
      const m = 360 + (idx % 5) * 40;
      const anchor = pointAlongLine(from, to, t);
      const wp = offsetPointM(anchor.lat, anchor.lng, (br + side) % 360, m);
      plans.push({
        label: `side-d-${idx++}`,
        via: [{ lat: wp.lat, lng: wp.lng }],
      });
    }
  }

  const doubleTemplates = [
    [0.2, 90, 300, 0.55, 270, 300],
    [0.25, 270, 280, 0.6, 90, 320],
    [0.3, 90, 380, 0.65, 270, 380],
    [0.35, 270, 340, 0.7, 90, 360],
    [0.4, 45, 400, 0.75, 225, 400],
    [0.18, 135, 260, 0.48, 315, 300],
    [0.52, 90, 420, 0.82, 270, 350],
    [0.28, 110, 320, 0.58, 250, 340],
    [0.32, 290, 360, 0.68, 70, 380],
    [0.45, 55, 440, 0.72, 235, 420],
  ];

  for (const [t1, s1, m1, t2, s2, m2] of doubleTemplates) {
    if (plans.length >= MAX_PLANS_TO_TRY) break;
    const a1 = pointAlongLine(from, to, t1);
    const a2 = pointAlongLine(from, to, t2);
    const wp1 = offsetPointM(a1.lat, a1.lng, (br + s1) % 360, m1);
    const wp2 = offsetPointM(a2.lat, a2.lng, (br + s2) % 360, m2);
    plans.push({
      label: `side-2-${idx++}`,
      via: [
        { lat: wp1.lat, lng: wp1.lng },
        { lat: wp2.lat, lng: wp2.lng },
      ],
    });
  }

  const distM = haversineM(from.lat, from.lng, to.lat, to.lng);
  if (distM > 1500) {
    const tripleTs = [0.25, 0.5, 0.75];
    const tripleSides = [
      [90, 270],
      [270, 90],
      [45, 225],
    ];
    for (const [sA, sB] of tripleSides) {
      if (plans.length >= MAX_PLANS_TO_TRY) break;
      const vias = tripleTs.map((t, i) => {
        const a = pointAlongLine(from, to, t);
        const side = i === 1 ? sB : sA;
        const p = offsetPointM(a.lat, a.lng, (br + side) % 360, 350 + i * 50);
        return { lat: p.lat, lng: p.lng };
      });
      plans.push({ label: `side-3-${idx++}`, via: vias });
    }
  }

  for (const t of [0.25, 0.4, 0.55, 0.7]) {
    for (const side of [85, 95, 265, 275]) {
      if (plans.length >= MAX_PLANS_TO_TRY) break;
      const anchor = pointAlongLine(from, to, t);
      const wp = offsetPointM(anchor.lat, anchor.lng, (br + side) % 360, 130);
      plans.push({ label: `mahalle-${idx++}`, via: [{ lat: wp.lat, lng: wp.lng }] });
    }
  }

  return plans;
}

/** Örgü Cad. → … → Yavuz Sultan Selim Cad. zinciri ve diğer sokak ara noktaları. */
async function fetchNamedSokakChainRoutes(from, to, collected) {
  let waypoints = [];
  try {
    waypoints = await buildResidentialWaypoints(from, to);
  } catch {
    waypoints = [];
  }

  if (waypoints.length < 2) {
    try {
      waypoints = await geocodeStreetChain(EXAMPLE_SOKAK_CHAIN, from, to);
    } catch {
      return;
    }
  }

  if (waypoints.length < 2) return;

  const viaCoords = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
  const labels = waypoints.map((w) => w.query || w.name).join(' → ');

  try {
    const full = await fetchDrivingRoute(from, to, viaCoords, { excludeMotorways: true });
    collected.push({
      ...full,
      variant: 'sokak-zinciri',
      streetLabels: labels,
    });
  } catch {
    /* parçalı dene */
  }

  const chunkSize = 4;
  for (let start = 0; start < waypoints.length - 2; start += 2) {
    const chunk = waypoints.slice(start, start + chunkSize).map((w) => ({ lat: w.lat, lng: w.lng }));
    if (chunk.length < 2) continue;
    try {
      const r = await fetchDrivingRoute(from, to, chunk, { excludeMotorways: true });
      collected.push({
        ...r,
        variant: `sokak-parca-${start + 1}`,
        streetLabels: waypoints
          .slice(start, start + chunkSize)
          .map((w) => w.query || w.name)
          .join(' → '),
      });
    } catch {
      /* */
    }
  }
}

async function fetchSideStreetRoutes(from, to, collected, target) {
  const plans = buildSideStreetViaPlans(from, to);

  for (let i = 0; i < plans.length && dedupeRoutes(collected).length < target; i += BATCH_SIZE) {
    const batch = plans.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (plan) => {
        try {
          const route = await fetchDrivingRoute(from, to, plan.via);
          return { ...route, variant: plan.label };
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r) collected.push(r);
    }
  }
}

/** OSRM alternatifleri + ara sokak via rotaları (hedef: 30 benzersiz yol). */
export async function fetchDrivingCandidates(from, to, target = TARGET_CANDIDATES) {
  const collected = [];

  await fetchNamedSokakChainRoutes(from, to, collected);

  try {
    const alts = await fetchDrivingRouteAlternatives(from, to, [], { excludeMotorways: true });
    const list = Array.isArray(alts) ? alts : [alts];
    for (const r of list) {
      collected.push({ ...r, variant: 'osrm-alt' });
    }
  } catch {
    /* devam */
  }

  if (!collected.length) {
    try {
      const single = await fetchDrivingRoute(from, to, [], { excludeMotorways: true });
      collected.push({ ...single, variant: 'osrm-direct' });
    } catch {
      /* ara sokak ile dene */
    }
  }

  await fetchSideStreetRoutes(from, to, collected, target);

  if (!collected.length) {
    throw new Error('OSRM rotası alınamadı.');
  }

  return dedupeRoutes(collected).slice(0, target);
}

export const fetchFourDrivingCandidates = fetchDrivingCandidates;

export function userReportsForRouteCheck(buildings, incident) {
  return (buildings || []).filter((b) => {
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return false;
    const h = { lat: b.lat, lng: b.lng, kind: 'user', buildingId: b.id };
    return !isIncidentHazard(h, incident);
  });
}

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
    variant: route.variant,
    sokakCount: route.sokakCount ?? 0,
    residentialScore: route.residentialScore ?? 0,
    streetLabels: route.streetLabels,
  };
}

function compareSafeRoutes(a, b) {
  const scoreA = (a.residentialScore || a.route?.residentialScore || 0) * 1e6 - a.distanceM;
  const scoreB = (b.residentialScore || b.route?.residentialScore || 0) * 1e6 - b.distanceM;
  if (scoreB !== scoreA) return scoreB - scoreA;
  if (a.variant === 'sokak-zinciri') return -1;
  if (b.variant === 'sokak-zinciri') return 1;
  return a.distanceM - b.distanceM;
}

export async function pickBestRouteAvoidingUserReports(from, to, buildings, incident) {
  const candidates = await fetchDrivingCandidates(from, to, TARGET_CANDIDATES);
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
      `${candidates.length} alternatif yolun tamamı kullanıcı bildirimine 15 m içinde kaldı (${names}${rejected.length > 3 ? '…' : ''}). Hedef veya bildirimleri kontrol edin.`
    );
  }

  safe.sort(compareSafeRoutes);
  const best = safe[0];

  const sokakInfo =
    best.sokakCount > 0
      ? ` · ${best.sokakCount} sokak segmenti`
      : best.residentialScore > 0
        ? ` · mahalle skoru ${best.residentialScore}`
        : '';
  const chainInfo = best.streetLabels
    ? ` · ${best.streetLabels.slice(0, 120)}${best.streetLabels.length > 120 ? '…' : ''}`
    : '';
  const notes = `${candidates.length} yol (otoyol hariç + cadde zinciri) · ${rejected.length} elendi · #${best.index} seçildi${sokakInfo}${chainInfo}`;

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
