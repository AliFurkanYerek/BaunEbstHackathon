import { useEffect, useState } from 'react';

/** USGS — Türkiye ve çevresi son depremler (AFAD/Kandilli ile uyumlu açık veri). */
const USGS_URL =
  'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-06-01&minlatitude=35&maxlatitude=43&minlongitude=25&maxlongitude=46&orderby=time&limit=40';

function mapFeature(f) {
  const p = f.properties || {};
  const [lng, lat, depth] = f.geometry?.coordinates || [0, 0, 0];
  return {
    id: f.id,
    time: p.time,
    place: p.place || '—',
    magnitude: p.mag,
    depthKm: depth != null ? Math.round(Math.abs(depth) * 10) / 10 : null,
    lat,
    lng,
    url: p.url,
    felt: p.felt,
  };
}

export function useEarthquakes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(USGS_URL);
        const data = await res.json();
        if (!res.ok) throw new Error('Deprem verisi alınamadı');
        const list = (data.features || []).map(mapFeature).filter((r) => r.magnitude != null);
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Bağlantı hatası');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, loading, error };
}
