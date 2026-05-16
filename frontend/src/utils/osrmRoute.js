/**
 * Açık OSRM — yürüyüş / araç; ara sokak için otoyol/trunk hariç tutulabilir.
 */

const OSRM_FOOT = 'https://router.project-osrm.org/route/v1/foot';
const OSRM_DRIVING = 'https://router.project-osrm.org/route/v1/driving';

const OSRM_TIMEOUT_MS = 11000;

/** Ana arterleri düşük öncelik — mahalle/sokak ağına iter. */
export const RESIDENTIAL_EXCLUDE = 'motorway,trunk,motorway_link,trunk_link';

function countSokakInRoute(route) {
  const names = [];
  for (const leg of route.legs || []) {
    for (const step of leg.steps || []) {
      if (step.name) names.push(step.name);
    }
  }
  const sokakCount = names.filter((n) => /sokak/i.test(n)).length;
  const caddeCount = names.filter((n) => /cadde/i.test(n)).length;
  return {
    streetNames: names,
    sokakCount,
    caddeCount,
    residentialScore: sokakCount * 3 + caddeCount,
  };
}

function mapOsrmRoute(route) {
  const positions = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const meta = countSokakInRoute(route);
  return {
    positions,
    distanceM: route.distance,
    durationS: route.duration,
    source: 'osrm',
    ...meta,
  };
}

async function fetchWithTimeout(url, ms = OSRM_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error('OSRM zaman aşımı — ağ yavaş veya servis meşgul.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOsrmRoute(base, points, { alternatives = false, excludeMotorways = true } = {}) {
  const coordStr = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const alt = alternatives ? '&alternatives=true&number=3' : '';
  const steps = '&steps=true';
  const exclude =
    excludeMotorways && base === OSRM_DRIVING
      ? `&exclude=${encodeURIComponent(RESIDENTIAL_EXCLUDE)}`
      : '';
  const url = `${base}/${coordStr}?overview=full&geometries=geojson${steps}${alt}${exclude}`;

  let res = await fetchWithTimeout(url);
  let data = await res.json().catch(() => ({}));

  if (
    exclude &&
    (!res.ok || data.code !== 'Ok' || !data.routes?.[0])
  ) {
    const urlNoEx = url.replace(/&exclude=[^&]+/, '');
    res = await fetchWithTimeout(urlNoEx);
    data = await res.json().catch(() => ({}));
  }

  if (!res.ok || data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(data.message || `Rota alınamadı (HTTP ${res.status})`);
  }

  if (alternatives) {
    return data.routes.map(mapOsrmRoute);
  }
  return mapOsrmRoute(data.routes[0]);
}

export async function fetchWalkingRoute(from, to) {
  return fetchOsrmRoute(OSRM_FOOT, [from, to], { excludeMotorways: false });
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.excludeMotorways=true] — otoyol/trunk kullanma
 */
export async function fetchDrivingRoute(from, to, via = [], opts = {}) {
  const points = [from, ...via, to];
  const excludeMotorways = opts.excludeMotorways !== false;
  return fetchOsrmRoute(OSRM_DRIVING, points, { excludeMotorways });
}

export async function fetchDrivingRouteAlternatives(from, to, via = [], opts = {}) {
  const points = [from, ...via, to];
  const excludeMotorways = opts.excludeMotorways !== false;
  return fetchOsrmRoute(OSRM_DRIVING, points, { alternatives: true, excludeMotorways });
}

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
    sokakCount: 0,
    residentialScore: 0,
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

export function formatRouteSummary(distanceM, durationS, mode = 'foot') {
  const km = distanceM / 1000;
  const kmStr = km < 1 ? `${Math.round(distanceM)} m` : `${km.toFixed(1)} km`;
  const min = Math.max(1, Math.round(durationS / 60));
  const label = mode === 'driving' ? 'araç (tahmini)' : 'yürüyüş (tahmini)';
  return `≈ ${kmStr} · ${min} dk ${label}`;
}
