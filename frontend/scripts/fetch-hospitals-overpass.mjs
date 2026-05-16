/**
 * OpenStreetMap Overpass → public/data/hospitals-tr.json
 * Çalıştır: node frontend/scripts/fetch-hospitals-overpass.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/data/hospitals-tr.json');

const QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="TR"]->.tr;
(
  node["amenity"="hospital"](area.tr);
  node["amenity"="clinic"]["healthcare"="hospital"](area.tr);
  way["amenity"="hospital"](area.tr);
);
out center;
`.trim();

const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function elementToHospital(el) {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const tags = el.tags || {};
  const name =
    tags.name ||
    tags['name:tr'] ||
    tags.operator ||
    'Hastane';

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    lat,
    lng,
    il: tags['addr:city'] || tags['addr:province'] || '',
    ilce: tags['addr:district'] || tags['addr:suburb'] || '',
    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
    emergency: tags.emergency === 'yes',
    source: 'OpenStreetMap',
  };
}

async function fetchOverpass(url) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AfetKoordinasyonHackathon/1.0 (disaster coordination demo)',
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  if (text.trimStart().startsWith('<')) throw new Error(`${url} HTML yanıt`);
  return JSON.parse(text);
}

async function main() {
  let data = null;
  let lastErr = null;
  for (const url of ENDPOINTS) {
    try {
      console.log('Sorgu:', url);
      data = await fetchOverpass(url);
      break;
    } catch (e) {
      lastErr = e;
      console.warn('  başarısız:', e.message);
    }
  }
  if (!data?.elements?.length) {
    throw lastErr || new Error('Overpass verisi alınamadı');
  }

  const hospitals = [];
  const seen = new Set();
  for (const el of data.elements) {
    const h = elementToHospital(el);
    if (!h) continue;
    const key = `${h.lat.toFixed(5)},${h.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hospitals.push(h);
  }

  hospitals.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(hospitals));
  console.log(`✓ ${hospitals.length} hastane → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
