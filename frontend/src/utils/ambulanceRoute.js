/**
 * Ambulans rotası — 30 aday (OSRM + ara sokak); kullanıcı bildirimi 15 m elemesi.
 */
import { findNearestHospital } from './distanceCalculator.js';
import { estimateAmbulanceCount } from './ambulanceCount.js';
import { formatRouteSummary } from './osrmRoute.js';
import { withTimeout } from './routeDeadline.js';
import { collectAllRouteHazards, getAvoidanceHazards, USER_REPORT_AVOID_RADIUS_M } from './hazardZones.js';
import { pickBestRouteAvoidingUserReports, userReportsForRouteCheck } from './routeCandidatePicker.js';

const ROUTE_COLOR = '#22c55e';
const BUILD_ROUTE_TIMEOUT_MS = 120000;

function resolveHospital(destination, hospitals) {
  const h = findNearestHospital(destination.lat, destination.lng, hospitals);
  if (!h?.lat || !h?.lng) return null;
  return { lat: h.lat, lng: h.lng, name: h.name };
}

/** Haritada gösterilecek kullanıcı bildirimi daireleri (15 m). */
function userHazardsForMap(buildings, incident) {
  return userReportsForRouteCheck(buildings, incident).map((b) => ({
    lat: b.lat,
    lng: b.lng,
    radiusM: USER_REPORT_AVOID_RADIUS_M,
    kind: 'user',
    buildingId: b.id,
  }));
}

async function buildAmbulanceRouteInner({
  destination,
  hospitals,
  photoReports,
  buildings = [],
  selectedIncident = null,
}) {
  if (!Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) {
    throw new Error('Hedef konum geçersiz.');
  }

  const hospital = resolveHospital(destination, hospitals);
  if (!hospital) {
    throw new Error(
      'Hedefe yakın hastane bulunamadı. Sayfayı yenileyin veya: npm run fetch:hospitals'
    );
  }

  const incident = {
    lat: destination.lat,
    lng: destination.lng,
    name: destination.name || 'Olay yeri',
    kind: destination.kind,
    id: destination.id ?? selectedIncident?.id,
  };

  const from = { lat: hospital.lat, lng: hospital.lng, name: hospital.name };
  const to = incident;

  const picked = await pickBestRouteAvoidingUserReports(from, to, buildings, incident);
  const osrm = picked.route;

  const summary = formatRouteSummary(osrm.distanceM, osrm.durationS, 'driving');
  const route = {
    id: 'ambulance-route',
    positions: osrm.positions,
    distanceM: osrm.distanceM,
    durationS: osrm.durationS,
    source: 'osrm',
    color: ROUTE_COLOR,
    routeKind: 'ambulance',
    label:
      picked.route?.variant === 'sokak-zinciri'
        ? 'Ambulans — cadde/sokak zinciri'
        : `Ambulans — güvenli yol ${picked.selectedIndex}/${picked.candidateCount}`,
    streetLabels: picked.route?.streetLabels,
    sokakCount: picked.route?.sokakCount,
    from,
    to,
    summary,
    isEstimate: false,
    weight: 6,
    opacity: 0.95,
    showEndpoints: true,
  };

  const userHazards = userHazardsForMap(buildings, incident);
  const allHazards = getAvoidanceHazards(
    collectAllRouteHazards(photoReports, buildings),
    incident
  );

  const ambulance = estimateAmbulanceCount({
    destination: incident,
    buildings,
    photoReports,
    selectedIncident,
  });

  return {
    ok: true,
    routes: [route],
    primaryRoute: route,
    positions: osrm.positions,
    distanceM: osrm.distanceM,
    durationS: osrm.durationS,
    source: 'osrm',
    routeKind: 'ambulance',
    simpleRoute: false,
    from,
    to,
    originName: hospital.name,
    destinationName: incident.name,
    hospitalName: hospital.name,
    avoidsHazards: true,
    avoidHazards: userHazards,
    hazards: allHazards,
    geminiNotes: picked.routeNotes,
    streetLabels: picked.route?.streetLabels,
    sokakCount: picked.route?.sokakCount,
    routeCandidates: picked.evaluated,
    rejectedRouteCount: picked.rejectedCount,
    safeRouteCount: picked.safeCount,
    candidateCount: picked.candidateCount,
    summary,
    isEstimate: false,
    ambulanceCount: ambulance.count,
    ambulanceDetail: ambulance.detail,
    ambulanceMeta: ambulance,
  };
}

export function buildAmbulanceRoute(opts) {
  return withTimeout(
    buildAmbulanceRouteInner(opts),
    BUILD_ROUTE_TIMEOUT_MS,
    'Rota hesabı zaman aşımı (2 dk). Tekrar deneyin.'
  );
}
