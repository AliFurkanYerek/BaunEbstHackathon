import {
  getEmergencyCoefficient,
  normalizeEmergencyTypes,
} from '../data/sampleData.js';

/**
 * riskPuani = kisiSayisi * 3 + hasarSeviyesi * 25 + (seçili acil durum katsayıları toplamı)
 */
export function calculateRiskScore(building) {
  const people = Number(building.peopleCount) || 0;
  const damage = Number(building.damageLevel) || 1;
  const types = normalizeEmergencyTypes(building);
  const emergencyCoef = getEmergencyCoefficient(types);
  return people * 3 + damage * 25 + emergencyCoef;
}

export function getSuggestedAction(riskScore) {
  if (riskScore >= 250) return 'Acil kurtarma ekibi gönder';
  if (riskScore >= 150) return 'İlk yardım ve destek ekibi gönder';
  if (riskScore >= 80) return 'Kontrol ekibi yönlendir';
  return 'Beklemede takip et';
}

export function sortByRisk(buildings) {
  return [...buildings].sort((a, b) => b.riskScore - a.riskScore);
}

export function countCriticalBuildings(buildings, threshold = 150) {
  return buildings.filter((b) => b.riskScore >= threshold).length;
}
