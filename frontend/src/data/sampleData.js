export const EMERGENCY_TYPES = [
  { id: 'enkaz', label: 'Enkaz altında insan var', coefficient: 100 },
  { id: 'yarali', label: 'Yaralı var', coefficient: 80 },
  { id: 'yangin', label: 'Yangın var', coefficient: 90 },
  { id: 'ses', label: 'Ses geliyor', coefficient: 70 },
  { id: 'cocuk_yasli', label: 'Çocuk/yaşlı/engelli var', coefficient: 85 },
];

export const SAMPLE_SAFE_ZONES = [
  { id: 'zone-1', name: 'Okul Bahçesi', lat: 39.503, lng: 26.985, capacity: 400 },
  { id: 'zone-2', name: 'Belediye Toplanma Alanı', lat: 39.499, lng: 26.972, capacity: 600 },
  { id: 'zone-3', name: 'Spor Salonu', lat: 39.5055, lng: 26.981, capacity: 350 },
  { id: 'zone-4', name: 'Park Alanı', lat: 39.496, lng: 26.968, capacity: 250 },
];

export const MAP_CENTER = [39.0, 35.2];
export const MAP_ZOOM = 6;
export const MAP_ZOOM_LOCAL = 14;

export const STORAGE_KEY = 'afetKoordinasyonAI_buildings';

/** Tek tip veya dizi — geriye uyumluluk */
export function normalizeEmergencyTypes(building) {
  if (Array.isArray(building.emergencyTypes) && building.emergencyTypes.length > 0) {
    return building.emergencyTypes;
  }
  if (building.emergencyType) return [building.emergencyType];
  return [];
}

export function getEmergencyCoefficient(emergencyTypeOrTypes) {
  const types = Array.isArray(emergencyTypeOrTypes)
    ? emergencyTypeOrTypes
    : [emergencyTypeOrTypes];
  return types.reduce((sum, id) => {
    const c = EMERGENCY_TYPES.find((e) => e.id === id)?.coefficient ?? 0;
    return sum + c;
  }, 0);
}

export function getEmergencyLabels(emergencyTypes) {
  const types = normalizeEmergencyTypes({ emergencyTypes });
  return types.map((id) => EMERGENCY_TYPES.find((e) => e.id === id)?.label ?? id);
}

export function getEmergencyLabel(emergencyType) {
  return EMERGENCY_TYPES.find((e) => e.id === emergencyType)?.label ?? emergencyType;
}
