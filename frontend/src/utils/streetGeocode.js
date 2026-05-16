/**
 * Cadde/sokak adlarını Nominatim ile koordinata çevir (ara nokta zinciri).
 */
import { haversineM } from './riskGeometry.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AfetKoordinasyonAI/1.0 (ambulance-routing)';

/** Örnek mahalle rotası — Edremit (OSM sokak adları). */
export const EXAMPLE_SOKAK_CHAIN = [
  'Örgü Caddesi',
  'Anafartalar Caddesi',
  'Özdemir Sokak',
  'Oğuzlar Caddesi',
  'Aydın Sokak',
  'Saldıray Sokak',
  'Tan Sokak',
  'Güngör Caddesi',
  'Süreyya Halefoğlu Caddesi',
  'Yavuz Sultan Selim Caddesi',
];

function bboxAround(from, to, padDeg = 0.06) {
  const lats = [from.lat, to.lat];
  const lngs = [from.lng, to.lng];
  return {
    minLat: Math.min(...lats) - padDeg,
    maxLat: Math.max(...lats) + padDeg,
    minLng: Math.min(...lngs) - padDeg,
    maxLng: Math.max(...lngs) + padDeg,
  };
}

function cityHint(from, to) {
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  if (midLat > 39.2 && midLat < 39.8 && midLng > 26.5 && midLng < 27.2) {
    return 'Edremit, Balıkesir, Türkiye';
  }
  return 'Türkiye';
}

async function nominatimSearch(query, viewbox) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });
  if (viewbox) {
    params.set('viewbox', `${viewbox.minLng},${viewbox.maxLat},${viewbox.maxLng},${viewbox.minLat}`);
    params.set('bounded', '1');
  }

  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: { 'Accept-Language': 'tr', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data?.[0];
  if (!hit?.lat || !hit?.lon) return null;
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    name: hit.display_name?.split(',')[0] || query,
    query,
  };
}

/** Tek cadde/sokak ara. */
export async function geocodeStreetName(streetName, from, to) {
  const viewbox = bboxAround(from, to);
  const city = cityHint(from, to);
  return nominatimSearch(`${streetName}, ${city}`, viewbox);
}

/**
 * Sokak zincirini geocode et; başlangıç→bitiş hattına göre sırala.
 */
export async function geocodeStreetChain(streetNames, from, to) {
  const viewbox = bboxAround(from, to, 0.08);
  const city = cityHint(from, to);
  const results = [];

  for (const street of streetNames) {
    try {
      const hit = await nominatimSearch(`${street}, ${city}`, viewbox);
      if (hit) results.push(hit);
      await new Promise((r) => setTimeout(r, 220));
    } catch {
      /* sonraki */
    }
  }

  return sortPointsAlongRoute(results, from, to);
}

function sortPointsAlongRoute(points, from, to) {
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const len2 = dx * dx + dy * dy || 1e-12;

  return [...points]
    .map((p) => {
      const t = ((p.lng - from.lng) * dx + (p.lat - from.lat) * dy) / len2;
      return { ...p, t };
    })
    .filter((p) => p.t > 0.02 && p.t < 0.98)
    .sort((a, b) => a.t - b.t)
    .map(({ lat, lng, name, query }) => ({ lat, lng, name, query }));
}

/**
 * Koridor boyunca OSM'de "Sokak" içeren yolları ara (ek ara noktalar).
 */
export async function geocodeSokakAlongCorridor(from, to, max = 8) {
  const fractions = [0.15, 0.28, 0.4, 0.52, 0.64, 0.76, 0.88];
  const city = cityHint(from, to);
  const viewbox = bboxAround(from, to);
  const found = [];

  for (const t of fractions) {
    if (found.length >= max) break;
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;
    try {
      const hit = await nominatimSearch(`Sokak, ${lat.toFixed(4)}, ${lng.toFixed(4)}, ${city}`, viewbox);
      if (hit && !found.some((f) => haversineM(f.lat, f.lng, hit.lat, hit.lng) < 80)) {
        found.push(hit);
      }
      await new Promise((r) => setTimeout(r, 220));
    } catch {
      /* */
    }
  }

  return sortPointsAlongRoute(found, from, to);
}

/** Zinciri ve koridor sokaklarını birleştir. */
export async function buildResidentialWaypoints(from, to) {
  const chain = await geocodeStreetChain(EXAMPLE_SOKAK_CHAIN, from, to);
  const extra = await geocodeSokakAlongCorridor(from, to, 6);

  const merged = [];
  const seen = new Set();
  for (const p of [...chain, ...extra]) {
    const key = `${p.lat.toFixed(4)}_${p.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }

  return sortPointsAlongRoute(merged, from, to);
}
