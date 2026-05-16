import { useState, useEffect } from 'react';
import { FALLBACK_HOSPITALS } from '../data/fallbackHospitals.js';

const DATA_URL = '/data/hospitals-tr.json';

let cache = null;

export function useHospitals() {
  const [hospitals, setHospitals] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    if (cache?.length) {
      setHospitals(cache);
      setLoading(false);
      return;
    }

    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error('Hastane verisi yüklenemedi (404). npm run fetch:hospitals çalıştırın.');
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng)) : [];
        if (!list.length) {
          cache = FALLBACK_HOSPITALS;
          setHospitals(cache);
          setUsedFallback(true);
          setError('Hastane listesi boş; demo hastaneler kullanılıyor.');
        } else {
          cache = list;
          setHospitals(cache);
          setUsedFallback(false);
          setError(null);
        }
        setLoading(false);
      })
      .catch((e) => {
        cache = FALLBACK_HOSPITALS;
        setHospitals(cache);
        setUsedFallback(true);
        setError(e.message || 'Hastane verisi alınamadı');
        setLoading(false);
      });
  }, []);

  return {
    hospitals,
    loading,
    error,
    usedFallback,
    count: hospitals.length,
  };
}
