import { findNearestHospital } from './distanceCalculator.js';
import { fetchDrivingRoute, straightLineRoute, formatRouteSummary } from './osrmRoute.js';
import { getGeminiApiKey, planAmbulanceRouteWithGemini } from './gemini.js';
import {
  COLLAPSED_AVOID_RADIUS_M,
  collectDamageHazards,
  routeViolatesHazards,
  bypassWaypointForHazard,
  sampleRoutePositions,
  closestRoutePointToHazard,
} from './hazardZones.js';

const MAX_LOCAL_PASSES = 6;

function dedupeWaypoints(waypoints) {
  const out = [];
  for (const w of waypoints) {
    if (!Number.isFinite(w.lat) || !Number.isFinite(w.lng)) continue;
    const dup = out.some(
      (o) => Math.abs(o.lat - w.lat) < 1e-5 && Math.abs(o.lng - w.lng) < 1e-5
    );
    if (!dup) out.push({ lat: w.lat, lng: w.lng, reason: w.reason });
  }
  return out.slice(0, 6);
}

async function routeWithAvoidance(from, to, hazards, geminiWaypoints = []) {
  let via = dedupeWaypoints(geminiWaypoints);
  let route;

  try {
    route = await fetchDrivingRoute(from, to, via);
  } catch {
    route = straightLineRoute(from, to);
    route.source = 'straight';
  }

  for (let pass = 0; pass < MAX_LOCAL_PASSES; pass++) {
    if (!routeViolatesHazards(route.positions, hazards)) break;

    const violators = hazards.filter((h) => {
      const cp = closestRoutePointToHazard(route.positions, h);
      return cp.distM < (h.radiusM ?? COLLAPSED_AVOID_RADIUS_M);
    });

    if (!violators.length) break;

    for (const h of violators) {
      const bypass = bypassWaypointForHazard(h, route.positions);
      via.push({ ...bypass, reason: `${h.label} — ${COLLAPSED_AVOID_RADIUS_M} m tampon` });
    }
    via = dedupeWaypoints(via);

    try {
      route = await fetchDrivingRoute(from, to, via);
    } catch {
      break;
    }
  }

  return { route, via };
}

/**
 * @param {{
 *   destination: { lat: number; lng: number; name?: string; kind?: string };
 *   hospitals: Array<{ lat: number; lng: number; name?: string; il?: string }>;
 *   photoReports: Array<object>;
 *   useGemini?: boolean;
 * }} params
 */
export async function buildAmbulanceRoute({
  destination,
  hospitals,
  photoReports,
  useGemini = true,
}) {
  if (!Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) {
    throw new Error('Bildirilen konum geçersiz.');
  }

  const hospital = findNearestHospital(destination.lat, destination.lng, hospitals);
  if (!hospital?.lat || !hospital?.lng) {
    throw new Error('Yakın hastane bulunamadı.');
  }

  const hazards = collectDamageHazards(photoReports);
  const from = { lat: hospital.lat, lng: hospital.lng, name: hospital.name };
  const to = {
    lat: destination.lat,
    lng: destination.lng,
    name: destination.name || 'Bildirilen konum',
    kind: destination.kind,
  };

  let baseRoute;
  try {
    baseRoute = await fetchDrivingRoute(from, to);
  } catch {
    baseRoute = straightLineRoute(from, to);
    baseRoute.source = 'straight';
  }

  let geminiWaypoints = [];
  let geminiNotes = '';

  if (useGemini && getGeminiApiKey()) {
    try {
      const plan = await planAmbulanceRouteWithGemini({
        hospital: { name: hospital.name, lat: hospital.lat, lng: hospital.lng },
        destination: to,
        hazards,
        routeSample: sampleRoutePositions(baseRoute.positions),
        avoidRadiusM: COLLAPSED_AVOID_RADIUS_M,
      });
      geminiWaypoints = plan.waypoints;
      geminiNotes = plan.notes;
    } catch {
      /* Yerel kaçınma ile devam */
    }
  }

  const { route, via } = await routeWithAvoidance(from, to, hazards, geminiWaypoints);
  const stillViolates = routeViolatesHazards(route.positions, hazards);

  return {
    ok: true,
    positions: route.positions,
    distanceM: route.distanceM,
    durationS: route.durationS,
    source: route.source,
    routeKind: 'ambulance',
    from,
    to,
    originName: hospital.name,
    destinationName: to.name,
    hospitalName: hospital.name,
    hospitalDistanceKm: hospital.distanceKm,
    hazards,
    hazardCount: hazards.length,
    waypointCount: via.length,
    avoidsCollapsed: !stillViolates,
    geminiNotes,
    summary: formatRouteSummary(route.distanceM, route.durationS, 'driving'),
    isEstimate: route.source === 'straight',
  };
}
