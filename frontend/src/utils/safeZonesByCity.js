export const ALL_CITIES = '__all__';
const UNKNOWN_CITY = 'Belirtilmemiş';

/** İl adını gruplama anahtarı olarak normalize eder */
export function getZoneCity(zone) {
  const raw = (zone?.il || zone?.city || '').trim();
  return raw || UNKNOWN_CITY;
}

/** Güvenli bölgeleri şehre (il) göre gruplar */
export function groupSafeZonesByCity(zones) {
  const map = new Map();

  for (const zone of zones) {
    const city = getZoneCity(zone);
    if (!map.has(city)) {
      map.set(city, {
        city,
        zones: [],
        count: 0,
        totalCapacity: 0,
      });
    }
    const group = map.get(city);
    group.zones.push(zone);
    group.count += 1;
    group.totalCapacity += zone.capacity || 300;
  }

  return [...map.values()].sort((a, b) => a.city.localeCompare(b.city, 'tr'));
}

/** Dağılım satırlarını şehre göre gruplar (atanan kişi yüksek olan iller önce) */
export function groupDistributionByCity(distribution, safeZones) {
  const cityByZoneId = new Map(safeZones.map((z) => [z.id, getZoneCity(z)]));
  const map = new Map();

  for (const row of distribution) {
    const city = cityByZoneId.get(row.zoneId) || UNKNOWN_CITY;
    if (!map.has(city)) {
      map.set(city, {
        city,
        rows: [],
        totalAssigned: 0,
        totalArrived: 0,
        totalCapacity: 0,
        zoneCount: 0,
      });
    }
    const group = map.get(city);
    group.rows.push({ ...row, il: city });
    group.totalAssigned += row.assignedPeople;
    group.totalArrived += row.arrivedPeople ?? 0;
    group.totalCapacity += row.capacity;
    group.zoneCount += 1;
  }

  return [...map.values()].sort(
    (a, b) =>
      b.totalAssigned - a.totalAssigned || a.city.localeCompare(b.city, 'tr')
  );
}

/** Seçilen şehre göre bölge listesini filtreler */
export function filterZonesByCity(zones, selectedCity) {
  if (!selectedCity || selectedCity === ALL_CITIES) return zones;
  return zones.filter((z) => getZoneCity(z) === selectedCity);
}
