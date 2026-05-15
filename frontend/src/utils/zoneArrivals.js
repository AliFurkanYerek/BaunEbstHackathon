export const ZONE_ARRIVALS_KEY = 'afetKoordinasyonAI_zoneArrivals';

export function loadZoneArrivals() {
  try {
    const raw = localStorage.getItem(ZONE_ARRIVALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveZoneArrivals(arrivals) {
  localStorage.setItem(ZONE_ARRIVALS_KEY, JSON.stringify(arrivals));
}

/** zoneId → o bölgeye bildirilen toplam kişi sayısı */
export function arrivalsByZoneId(arrivals) {
  const m = new Map();
  for (const a of arrivals) {
    const z = String(a.zoneId || '');
    if (!z) continue;
    const n = Math.max(1, Number(a.peopleCount) || 1);
    m.set(z, (m.get(z) || 0) + n);
  }
  return m;
}

export function totalArrivalPeopleCount(arrivals) {
  return arrivals.reduce((s, a) => s + Math.max(1, Number(a.peopleCount) || 1), 0);
}
