import { db } from '../db.js';
import { distanceKm } from './geo.js';

export interface EvacuationAssignment {
  buildingId: string;
  buildingName: string;
  address: string;
  lat: number;
  lng: number;
  occupants: number;
  damageLevel: string;
  safeZoneId: string;
  safeZoneName: string;
  distanceKm: number;
}

export interface AidEstimate {
  safeZoneId: string;
  safeZoneName: string;
  assignedBuildings: number;
  totalEvacuees: number;
  capacity: number;
  utilizationPercent: number;
  recommended: {
    waterLiters: number;
    foodPortions: number;
    medicalKits: number;
    blankets: number;
  };
  currentStock: {
    water: number;
    food: number;
    medical: number;
    blankets: number;
  };
  deficit: {
    water: number;
    food: number;
    medical: number;
    blankets: number;
  };
}

/** Binaları en yakın uygun güvenli bölgeye atar (kapasite sınırıyla). */
export function planEvacuation(): {
  assignments: EvacuationAssignment[];
  unassigned: EvacuationAssignment[];
  aidEstimates: AidEstimate[];
} {
  const buildings = db
    .prepare(
      `SELECT id, name, address, lat, lng, estimated_occupants, damage_level
       FROM buildings
       WHERE damage_level IN ('moderate','severe','collapsed','minor')`
    )
    .all() as Array<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    estimated_occupants: number;
    damage_level: string;
  }>;

  const zones = db
    .prepare(`SELECT * FROM safe_zones`)
    .all() as Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    capacity: number;
    supplies_water: number;
    supplies_food: number;
    supplies_medical: number;
    supplies_blankets: number;
  }>;

  const zoneLoad = new Map<string, number>();
  for (const z of zones) zoneLoad.set(z.id, 0);

  const assignments: EvacuationAssignment[] = [];
  const unassigned: EvacuationAssignment[] = [];

  const sorted = [...buildings].sort((a, b) => {
    const order: Record<string, number> = {
      collapsed: 4,
      severe: 3,
      moderate: 2,
      minor: 1,
    };
    return (order[b.damage_level] ?? 0) - (order[a.damage_level] ?? 0);
  });

  for (const b of sorted) {
    const candidates = zones
      .map((z) => ({
        zone: z,
        dist: distanceKm(b.lat, b.lng, z.lat, z.lng),
        load: zoneLoad.get(z.id) ?? 0,
      }))
      .filter((c) => c.load + b.estimated_occupants <= c.zone.capacity)
      .sort((a, c) => a.dist - c.dist);

    const pick = candidates[0];
    const entry: EvacuationAssignment = {
      buildingId: b.id,
      buildingName: b.name,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      occupants: b.estimated_occupants,
      damageLevel: b.damage_level,
      safeZoneId: pick?.zone.id ?? '',
      safeZoneName: pick?.zone.name ?? '',
      distanceKm: pick ? Math.round(pick.dist * 100) / 100 : 0,
    };

    if (pick) {
      zoneLoad.set(pick.zone.id, pick.load + b.estimated_occupants);
      assignments.push(entry);
    } else {
      unassigned.push(entry);
    }
  }

  const zoneAssignments = new Map<string, EvacuationAssignment[]>();
  for (const a of assignments) {
    const list = zoneAssignments.get(a.safeZoneId) ?? [];
    list.push(a);
    zoneAssignments.set(a.safeZoneId, list);
  }

  const aidEstimates: AidEstimate[] = zones.map((z) => {
    const assigned = zoneAssignments.get(z.id) ?? [];
    const totalEvacuees = assigned.reduce((s, a) => s + a.occupants, 0);
    const recommended = {
      waterLiters: totalEvacuees * 3,
      foodPortions: totalEvacuees * 2,
      medicalKits: Math.ceil(totalEvacuees / 20),
      blankets: totalEvacuees,
    };
    const currentStock = {
      water: z.supplies_water,
      food: z.supplies_food,
      medical: z.supplies_medical,
      blankets: z.supplies_blankets,
    };
    return {
      safeZoneId: z.id,
      safeZoneName: z.name,
      assignedBuildings: assigned.length,
      totalEvacuees,
      capacity: z.capacity,
      utilizationPercent:
        z.capacity > 0
          ? Math.round((totalEvacuees / z.capacity) * 100)
          : 0,
      recommended,
      currentStock,
      deficit: {
        water: Math.max(0, recommended.waterLiters - currentStock.water),
        food: Math.max(0, recommended.foodPortions - currentStock.food),
        medical: Math.max(0, recommended.medicalKits - currentStock.medical),
        blankets: Math.max(0, recommended.blankets - currentStock.blankets),
      },
    };
  });

  return { assignments, unassigned, aidEstimates };
}
