import { db } from '../db.js';
import { distanceKm } from './geo.js';

export type SosCommand =
  | 'trapped'
  | 'injured'
  | 'fire'
  | 'gas_leak'
  | 'child_missing'
  | 'elderly_trapped'
  | 'multiple_casualties';

const COMMAND_WEIGHTS: Record<SosCommand, number> = {
  trapped: 90,
  multiple_casualties: 95,
  injured: 75,
  elderly_trapped: 85,
  child_missing: 80,
  fire: 70,
  gas_leak: 65,
};

const DAMAGE_BOOST: Record<string, number> = {
  collapsed: 40,
  severe: 30,
  moderate: 15,
  minor: 5,
  intact: 0,
  unknown: 10,
};

export interface PriorityResult {
  priorityScore: number;
  reasoning: string;
  nearestBuilding?: { id: string; name: string; distanceKm: number };
  recommendedTeams: string[];
}

/**
 * Acil komut + konum + yakın bina hasarı ile kurtarma önceliği hesaplar.
 */
export function calculateRescuePriority(
  commandType: SosCommand,
  lat: number,
  lng: number
): PriorityResult {
  const base = COMMAND_WEIGHTS[commandType] ?? 50;

  const buildings = db
    .prepare(
      `SELECT id, name, lat, lng, damage_level, estimated_occupants
       FROM buildings`
    )
    .all() as Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    damage_level: string;
    estimated_occupants: number;
  }>;

  let nearest: (typeof buildings)[0] | undefined;
  let minDist = Infinity;

  for (const b of buildings) {
    const d = distanceKm(lat, lng, b.lat, b.lng);
    if (d < minDist) {
      minDist = d;
      nearest = b;
    }
  }

  let damageBoost = 0;
  let occupantBoost = 0;
  if (nearest) {
    damageBoost = DAMAGE_BOOST[nearest.damage_level] ?? 10;
    occupantBoost = Math.min(25, (nearest.estimated_occupants / 50) * 25);
  }

  const proximityPenalty = minDist < 0.2 ? 15 : minDist < 0.5 ? 8 : 0;
  const priorityScore = Math.min(
    100,
    base + damageBoost + occupantBoost + proximityPenalty
  );

  const commandLabels: Record<SosCommand, string> = {
    trapped: 'Enkaz altında mahsur',
    injured: 'Yaralı bildirimi',
    fire: 'Yangın',
    gas_leak: 'Gaz kaçağı',
    child_missing: 'Kayıp çocuk',
    elderly_trapped: 'Yaşlı mahsur',
    multiple_casualties: 'Çoklu yaralı',
  };

  const parts = [
    `Komut: ${commandLabels[commandType]} (ağırlık ${base})`,
  ];
  if (nearest) {
    parts.push(
      `En yakın bina: "${nearest.name}" (${minDist.toFixed(2)} km), hasar: ${nearest.damage_level}, ~${nearest.estimated_occupants} kişi`
    );
    parts.push(`Hasar bonusu +${damageBoost}, nüfus bonusu +${occupantBoost.toFixed(0)}`);
  }
  parts.push(`Öncelik skoru: ${priorityScore.toFixed(1)}/100`);

  const recommendedTeams: string[] = [];
  if (commandType === 'fire' || commandType === 'gas_leak') {
    recommendedTeams.push('İtfaiye', 'AFAD');
  } else if (commandType === 'injured' || commandType === 'multiple_casualties') {
    recommendedTeams.push('112 Sağlık', 'UMKE');
  } else {
    recommendedTeams.push('AFAD Arama Kurtarma', 'UMKE');
  }
  if (nearest?.damage_level === 'collapsed' || commandType === 'trapped') {
    recommendedTeams.push('K9 Birimi');
  }

  return {
    priorityScore,
    reasoning: parts.join('. '),
    nearestBuilding: nearest
      ? { id: nearest.id, name: nearest.name, distanceKm: minDist }
      : undefined,
    recommendedTeams,
  };
}
