import { MAP_CENTER, MAP_ZOOM, STORAGE_KEY } from '../data/sampleData.js';
import { loadPhotoReports } from './photoDamageStorage.js';
import { loadZoneArrivals } from './zoneArrivals.js';

export const OFFLINE_SNAPSHOT_KEY = 'afet_offline_snapshot_v1';
export const EMERGENCY_AUTO_KEY = 'afet_emergency_auto_offline';
export const EMERGENCY_SESSION_KEY = 'afet_emergency_session';

export function loadOfflineSnapshot() {
  try {
    const raw = localStorage.getItem(OFFLINE_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveOfflineSnapshot(payload) {
  const prev = loadOfflineSnapshot() || {};
  const next = {
    ...prev,
    ...payload,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(next));
  return next;
}

/** Çevrimiçiyken tüm harita verisini önbelleğe al */
export function snapshotAppState({
  assemblyPoints = [],
  hospitals = [],
  buildings = [],
  photoReports = [],
  zoneArrivals = [],
  mapCenter = MAP_CENTER,
  mapZoom = MAP_ZOOM,
}) {
  let b = buildings;
  if (!b?.length) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      b = raw ? JSON.parse(raw) : [];
    } catch {
      b = [];
    }
  }
  return saveOfflineSnapshot({
    assemblyPoints,
    hospitals,
    buildings: b,
    photoReports: photoReports?.length ? photoReports : loadPhotoReports(),
    zoneArrivals: zoneArrivals?.length ? zoneArrivals : loadZoneArrivals(),
    mapCenter,
    mapZoom,
  });
}

export function getEmergencyMapData() {
  const snap = loadOfflineSnapshot();
  return {
    assemblyPoints: snap?.assemblyPoints ?? [],
    hospitals: snap?.hospitals ?? [],
    buildings: snap?.buildings ?? [],
    photoReports: snap?.photoReports ?? loadPhotoReports(),
    zoneArrivals: snap?.zoneArrivals ?? [],
    mapCenter: snap?.mapCenter ?? MAP_CENTER,
    mapZoom: snap?.mapZoom ?? MAP_ZOOM,
    savedAt: snap?.savedAt ?? null,
  };
}

export function setEmergencyAutoOffline(enabled) {
  localStorage.setItem(EMERGENCY_AUTO_KEY, enabled ? '1' : '0');
}

export function isEmergencyAutoOffline() {
  return localStorage.getItem(EMERGENCY_AUTO_KEY) === '1';
}

export function saveEmergencySession(session) {
  localStorage.setItem(EMERGENCY_SESSION_KEY, JSON.stringify(session));
}

export function loadEmergencySession() {
  try {
    const raw = localStorage.getItem(EMERGENCY_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearEmergencySession() {
  localStorage.removeItem(EMERGENCY_SESSION_KEY);
}

export function registerEmergencyServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register('/emergency-sw.js').catch(() => null);
}
