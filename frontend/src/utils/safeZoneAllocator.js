import { distanceKm } from './distanceCalculator.js';
import { calculateBuildingAid } from './aidCalculator.js';

/**
 * Her binayı en yakın uygun güvenli bölgeye atar (kapasite aşımında alternatif).
 */
export function allocateBuildingsToSafeZones(buildings, safeZones) {
  const zoneLoad = new Map(safeZones.map((z) => [z.id, 0]));
  const assignments = [];

  const sortedBuildings = [...buildings].sort((a, b) => b.riskScore - a.riskScore);

  for (const building of sortedBuildings) {
    const people = Number(building.peopleCount) || 0;
    const candidates = safeZones
      .map((zone) => ({
        zone,
        dist: distanceKm(building.lat, building.lng, zone.lat, zone.lng),
        load: zoneLoad.get(zone.id) ?? 0,
      }))
      .sort((a, b) => a.dist - b.dist);

    const pick =
      candidates.find((c) => c.load + people <= c.zone.capacity) ?? null;

    if (pick) {
      zoneLoad.set(pick.zone.id, pick.load + people);
      assignments.push({
        buildingId: building.id,
        zoneId: pick.zone.id,
        people,
      });
    }
  }

  const distribution = safeZones.map((zone) => {
    const assigned = assignments.filter((a) => a.zoneId === zone.id);
    const assignedPeople = assigned.reduce((s, a) => s + a.people, 0);
    const utilization =
      zone.capacity > 0 ? Math.round((assignedPeople / zone.capacity) * 100) : 0;
    const aid = calculateBuildingAid(assignedPeople);

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      capacity: zone.capacity,
      assignedPeople,
      utilizationPercent: utilization,
      aidNeeded: aid,
      assignedBuildingCount: assigned.length,
    };
  });

  return { assignments, distribution };
}
