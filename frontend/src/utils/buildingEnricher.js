import { calculateRiskScore, getSuggestedAction } from './riskCalculator.js';
import { calculateBuildingAid } from './aidCalculator.js';
import { findNearestSafeZone } from './distanceCalculator.js';
import { normalizeEmergencyTypes } from '../data/sampleData.js';

export function enrichBuilding(raw, safeZones) {
  const emergencyTypes = normalizeEmergencyTypes(raw);
  const normalized = { ...raw, emergencyTypes };
  const riskScore = calculateRiskScore(normalized);
  const nearestSafeZone = findNearestSafeZone(raw.lat, raw.lng, safeZones);
  const aidNeeds = calculateBuildingAid(raw.peopleCount);

  return {
    ...normalized,
    riskScore,
    nearestSafeZone,
    aidNeeds,
    suggestedAction: getSuggestedAction(riskScore),
  };
}

export function enrichAllBuildings(buildings, safeZones) {
  return buildings.map((b) => enrichBuilding(b, safeZones));
}
