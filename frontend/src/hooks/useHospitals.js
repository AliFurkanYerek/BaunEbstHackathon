import { useState, useEffect } from 'react';

const DATA_URL = '/data/hospitals-tr.json';

let cache = null;

export function useHospitals() {
  const [hospitals, setHospitals] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cache) {
      setHospitals(cache);
      setLoading(false);
      return;
    }

    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error('Hastane verisi yüklenemedi');
        return r.json();
      })
      .then((data) => {
        cache = Array.isArray(data) ? data : [];
        setHospitals(cache);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return { hospitals, loading, error, count: hospitals.length };
}
