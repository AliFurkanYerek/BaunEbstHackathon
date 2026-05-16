export const MAP_LAYER_ALL = 'all';
export const MAP_LAYER_SAFE = 'safe';
export const MAP_LAYER_HOSPITAL = 'hospital';
export const MAP_LAYER_REPORTS = 'reports';

export const USER_MAP_LAYERS = [
  { id: MAP_LAYER_ALL, label: 'Tümü', short: 'Hepsi' },
  { id: MAP_LAYER_SAFE, label: 'Güvenli bölge', short: 'AFAD' },
  { id: MAP_LAYER_HOSPITAL, label: 'Hastane', short: 'Hastane' },
];

export const AUTHORITY_MAP_LAYERS = [
  ...USER_MAP_LAYERS,
  { id: MAP_LAYER_REPORTS, label: 'Bildirilenler', short: 'Bildirim' },
];

export function showsSafeZones(layer) {
  return layer === MAP_LAYER_ALL || layer === MAP_LAYER_SAFE;
}

export function showsHospitals(layer) {
  return layer === MAP_LAYER_ALL || layer === MAP_LAYER_HOSPITAL;
}

export function showsReports(layer) {
  return layer === MAP_LAYER_ALL || layer === MAP_LAYER_REPORTS;
}
