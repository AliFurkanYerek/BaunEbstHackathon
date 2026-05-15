import { useState, useEffect, useMemo } from 'react';

const DATA_URL = '/data/toplanma-alanlari-tr.json';

let cache = null;

export function useAssemblyPoints() {
  const [points, setPoints] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cache) {
      setPoints(cache);
      setLoading(false);
      return;
    }

    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error('Toplanma alanı verisi yüklenemedi');
        return r.json();
      })
      .then((data) => {
        cache = Array.isArray(data) ? data : [];
        setPoints(cache);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const provinces = useMemo(() => {
    const set = new Set();
    for (const p of points) {
      if (p.il) set.add(p.il);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [points]);

  return {
    assemblyPoints: points,
    loading,
    error,
    count: points.length,
    provinces,
    isPartialCoverage: provinces.length > 0 && provinces.length < 20,
  };
}

/** safeZones formatına dönüştür (mevcut hesaplamalar için) */
export function toSafeZones(assemblyPoints) {
  return assemblyPoints.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    capacity: p.capacity || 300,
    il: p.il,
    ilce: p.ilce,
    address: p.address,
    source: p.source,
  }));
}
