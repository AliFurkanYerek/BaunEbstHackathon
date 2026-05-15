/**
 * AFAD toplanma alanı açık verisini işler → public/data/toplanma-alanlari-tr.json
 * Kaynak: https://github.com/RKursatV/afad-toplanma-alani-acik-veri
 *
 * Not: GitHub'da yalnızca DepremIlleriToplu + ~11 il dosyası var.
 * İstanbul, İzmir, Balıkesir, Antalya vb. için ayrı JSON yok (404).
 * Tüm Türkiye için: repodaki collect.py + scraper.py ile e-Devlet'ten çekilmeli.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/data/toplanma-alanlari-tr.json');
const BASE =
  'https://raw.githubusercontent.com/RKursatV/afad-toplanma-alani-acik-veri/main';
const CITIES_URL = `${BASE}/cities.json`;

/** Türkçe karakter → dosya adı (repo convention) */
function cityFileName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, '');
}

function extractPoints(provinceData) {
  const points = new Map();

  const processIl = (il) => {
    if (!il?.ilceler) return;
    for (const ilce of Object.values(il.ilceler)) {
      if (!ilce?.mahalleler) continue;
      for (const mah of Object.values(ilce.mahalleler)) {
        const alanlar = mah.toplanmaAlanlari;
        if (!alanlar) continue;
        for (const a of Object.values(alanlar)) {
          if (!a?.id || a.x == null || a.y == null) continue;
          const lng = Number(a.x);
          const lat = Number(a.y);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          if (lat < 35 || lat > 43 || lng < 25 || lng > 46) continue;

          points.set(String(a.id), {
            id: String(a.id),
            name: (a.tesis_adi || 'AFAD Toplanma Alanı').trim(),
            lat: Math.round(lat * 1e6) / 1e6,
            lng: Math.round(lng * 1e6) / 1e6,
            il: a.il_adi || '',
            ilce: a.ilce_adi || '',
            mahalle: a.mahalle_adi || '',
            address: a.acik_adres || '',
            capacity: 300,
            source: 'AFAD',
          });
        }
      }
    }
  };

  for (const key of Object.keys(provinceData)) {
    const val = provinceData[key];
    if (val?.ilceler) processIl(val);
    else if (typeof val === 'object') {
      for (const inner of Object.values(val)) {
        if (inner?.ilceler) processIl(inner);
      }
    }
  }
  return points;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  const all = new Map();
  const cities = await fetchJson(CITIES_URL);
  const files = new Set(['DepremIlleriToplu.json']);

  if (Array.isArray(cities)) {
    for (const c of cities) {
      files.add(`${cityFileName(c.name)}.json`);
    }
  }

  console.log(`${files.size} il dosyası denenecek...\n`);

  for (const file of files) {
    const url = `${BASE}/iller/${file}`;
    const data = await fetchJson(url);
    if (!data) continue;
    const pts = extractPoints(data);
    if (pts.size === 0) continue;
    for (const [id, p] of pts) all.set(id, p);
    console.log(`✓ ${file}: +${pts.size} (toplam ${all.size})`);
  }

  const list = [...all.values()].sort((a, b) =>
    (a.il || '').localeCompare(b.il || '', 'tr')
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(list));
  console.log(`\n✓ ${list.length} AFAD toplanma alanı kaydedildi`);
  console.log(`  ${OUT}`);
}

main().catch(console.error);
