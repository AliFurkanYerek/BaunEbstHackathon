import { STORAGE_KEY } from '../data/sampleData.js';

export function loadBuildingsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBuildingsToStorage(buildings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildings));
}

export const BUILDINGS_UPDATED_EVENT = 'afet-buildings-updated';

export function appendBuildingReport(building) {
  const list = loadBuildingsFromStorage();
  list.push(building);
  saveBuildingsToStorage(list);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BUILDINGS_UPDATED_EVENT));
  }
  return building;
}

export function isEnkazHomeReport(building) {
  return Boolean(building?.isEnkazSos || building?.reportSource === 'home_enkaz');
}
