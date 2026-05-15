/**
 * AFAD e-Devlet API üzerinden Marmara / Ege / Akdeniz illeri için toplanma alanı çeker.
 * Oturum (requests.Session) gerektirir; Node fetch çoğu zaman HTML döner — Python scraper tercih edin.
 *
 * Kullanım: cd scripts && python -c "from afad_scraper import AFADScraper; ..."
 * veya RKursatV/afad-toplanma-alani-acik-veri collect.py
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/data/toplanma-alanlari-tr.json');
const AFAD_URL =
  'https://www.turkiye.gov.tr/afet-ve-acil-durum-yonetimi-acil-toplanma-alani-sorgulama';

/** Marmara, Ege, Akdeniz — il kodu ve adı */
const TARGET_CITIES = [
  { code: 34, name: 'İstanbul', region: 'Marmara' },
  { code: 16, name: 'Bursa', region: 'Marmara' },
  { code: 41, name: 'Kocaeli', region: 'Marmara' },
  { code: 59, name: 'Tekirdağ', region: 'Marmara' },
  { code: 10, name: 'Balıkesir', region: 'Ege' },
  { code: 77, name: 'Yalova', region: 'Marmara' },
  { code: 35, name: 'İzmir', region: 'Ege' },
  { code: 45, name: 'Manisa', region: 'Ege' },
  { code: 48, name: 'Muğla', region: 'Ege' },
  { code: 9, name: 'Aydın', region: 'Ege' },
  { code: 20, name: 'Denizli', region: 'Ege' },
  { code: 7, name: 'Antalya', region: 'Akdeniz' },
  { code: 33, name: 'Mersin', region: 'Akdeniz' },
  { code: 1, name: 'Adana', region: 'Akdeniz' },
  { code: 32, name: 'Isparta', region: 'Akdeniz' },
  { code: 15, name: 'Burdur', region: 'Akdeniz' },
];

const HEADERS = {
  Host: 'www.turkiye.gov.tr',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9',
};

const MAX_DISTRICTS_PER_CITY = 8;
const MAX_MAHALLE_PER_DISTRICT = 4;
const DELAY_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getToken() {
  const res = await fetch(AFAD_URL, { headers: HEADERS });
  const html = await res.text();
  const m = html.match(/data-token="([^"]+)"/);
  if (!m) throw new Error('AFAD token alınamadı');
  return m[1];
}

async function postAfad(token, payload, referer = AFAD_URL) {
  const body = `token=${token}&ajax=1&pn=/afet-ve-acil-durum-yonetimi-acil-toplanma-alani-sorgulama&${payload}`;
  const res = await fetch(`${AFAD_URL}?submit`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: referer,
    },
    body,
  });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) {
    const text = await res.text();
    const m = text.match(/toplanmaAlanlari\s*=\s*(\[.*?\]);/s);
    if (m) return { htmlAreas: JSON.parse(m[1]) };
    return { raw: text };
  }
  return res.json();
}

function pointFromProps(p) {
  const lng = Number(p.x);
  const lat = Number(p.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 35 || lat > 43 || lng < 25 || lng > 46) return null;
  return {
    id: String(p.id),
    name: (p.tesis_adi || 'AFAD Toplanma Alanı').trim(),
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    il: p.il_adi || '',
    ilce: p.ilce_adi || '',
    mahalle: p.mahalle_adi || '',
    address: p.acik_adres || '',
    capacity: 300,
    source: 'AFAD',
  };
}

async function queryPoint(token, lng, lat) {
  const data = new URLSearchParams({
    pn: '/afet-ve-acil-durum-yonetimi-acil-toplanma-alani-sorgulama',
    ajax: '1',
    token,
    islem: 'getAlanlarForNokta',
    lat: String(lat),
    lng: String(lng),
  });
  const res = await fetch(`${AFAD_URL}?harita=goster&submit`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data,
  });
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function getAreasForMahalle(token, ilCode, ilceId, mahalleId) {
  const res = await postAfad(
    token,
    `ilKodu=${ilCode}&ilceKodu=${ilceId}&mahalleKodu=${mahalleId}&islem=sokakKodu`
  );
  if (res?.htmlAreas?.[0]?.geometry?.coordinates) {
    const coords = res.htmlAreas[0].geometry.coordinates[0] || [];
    const points = coords.slice(0, 5);
    const results = [];
    for (const [lng, lat] of points) {
      const q = await queryPoint(token, lng, lat);
      if (q?.features) {
        for (const f of q.features) {
          const pt = pointFromProps(f.properties || f);
          if (pt) results.push(pt);
        }
      }
      await sleep(200);
    }
    return results;
  }
  return [];
}

async function fetchCity(token, city) {
  const points = new Map();
  console.log(`\n📍 ${city.name} (${city.region})...`);

  let data;
  try {
    data = await postAfad(token, `ilKodu=${city.code}&islem=ilceKodu`);
  } catch (e) {
    console.warn(`  İlçe listesi alınamadı: ${e.message}`);
    return points;
  }

  const districts = data?.data?.dataArr || [];
  const slice = districts.slice(0, MAX_DISTRICTS_PER_CITY);
  console.log(`  ${slice.length}/${districts.length} ilçe taranacak`);

  for (const district of slice) {
    await sleep(DELAY_MS);
    let mahData;
    try {
      mahData = await postAfad(
        token,
        `ilKodu=${city.code}&ilceKodu=${district.id}&islem=mahalleKodu`
      );
    } catch {
      continue;
    }
    const mahalleler = (mahData?.data?.dataArr || []).slice(0, MAX_MAHALLE_PER_DISTRICT);
    for (const mah of mahalleler) {
      await sleep(DELAY_MS);
      try {
        const found = await getAreasForMahalle(token, city.code, district.id, mah.id);
        for (const p of found) {
          points.set(p.id, { ...p, il: p.il || city.name });
        }
      } catch {
        /* skip */
      }
    }
    process.stdout.write(`  ${district.name}: +${points.size} toplam\r`);
  }
  console.log(`\n  ✓ ${city.name}: ${points.size} nokta`);
  return points;
}

async function main() {
  let existing = [];
  if (fs.existsSync(OUT)) {
    existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    console.log(`Mevcut: ${existing.length} nokta`);
  }

  const all = new Map(existing.map((p) => [p.id, p]));
  const token = await getToken();
  console.log('AFAD token alındı');

  for (const city of TARGET_CITIES) {
    const pts = await fetchCity(token, city);
    for (const [id, p] of pts) all.set(id, p);
    fs.writeFileSync(OUT, JSON.stringify([...all.values()]));
    console.log(`  Kaydedildi (toplam ${all.size})`);
  }

  const list = [...all.values()].sort((a, b) =>
    (a.il || '').localeCompare(b.il || '', 'tr')
  );
  fs.writeFileSync(OUT, JSON.stringify(list));
  console.log(`\n✅ Toplam ${list.length} toplanma alanı → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
