import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import EmergencyModePlatform from './components/EmergencyModePlatform.jsx';
import UserPlatform from './components/UserPlatform.jsx';
import AuthorityPlatform from './components/AuthorityPlatform.jsx';
import { loadSession, clearSession } from './data/authCredentials.js';
import { STORAGE_KEY, MAP_CENTER, MAP_ZOOM } from './data/sampleData.js';
import { enrichAllBuildings } from './utils/buildingEnricher.js';
import { sortByRisk } from './utils/riskCalculator.js';
import { useAssemblyPoints, toSafeZones } from './hooks/useAssemblyPoints.js';
import { useHospitals } from './hooks/useHospitals.js';
import { groupSafeZonesByCity } from './utils/safeZonesByCity.js';
import { loadZoneArrivals, saveZoneArrivals } from './utils/zoneArrivals.js';
import {
  loadPhotoReports,
  savePhotoReports,
  createPhotoReport,
} from './utils/photoDamageStorage.js';
import {
  snapshotAppState,
  loadEmergencySession,
  clearEmergencySession,
  isEmergencyAutoOffline,
  registerEmergencyServiceWorker,
} from './utils/offlineCache.js';
import { useOnlineStatus } from './hooks/useOnlineStatus.js';
import { BUILDINGS_UPDATED_EVENT } from './utils/buildingStorage.js';

let idCounter = Date.now();

function loadBuildings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBuildings(buildings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildings));
}

export default function App() {
  const online = useOnlineStatus();
  const emergencyStored = loadEmergencySession();
  const [session, setSession] = useState(() => loadSession() || emergencyStored);
  const [emergencyMode, setEmergencyMode] = useState(
    () => Boolean(emergencyStored?.emergency)
  );

  const platform =
    session?.role === 'authority' ? 'authority' : session?.role === 'emergency' ? 'emergency' : 'user';

  const { assemblyPoints, loading: zonesLoading } = useAssemblyPoints();
  const {
    hospitals,
    loading: hospitalsLoading,
    error: hospitalsError,
    count: hospitalCount,
  } = useHospitals();
  const safeZones = useMemo(() => toSafeZones(assemblyPoints), [assemblyPoints]);
  const zonesByCity = useMemo(() => groupSafeZonesByCity(safeZones), [safeZones]);
  const [rawBuildings, setRawBuildings] = useState(loadBuildings);
  const [zoneArrivals, setZoneArrivals] = useState(loadZoneArrivals);
  const [photoReports, setPhotoReports] = useState(loadPhotoReports);
  const snapshotTimer = useRef(null);

  const buildings = useMemo(
    () => sortByRisk(enrichAllBuildings(rawBuildings, safeZones)),
    [rawBuildings, safeZones]
  );

  useEffect(() => {
    registerEmergencyServiceWorker();
  }, []);

  useEffect(() => {
    if (!online && isEmergencyAutoOffline() && session && !emergencyMode) {
      const em = { role: 'emergency', username: 'acil', label: 'Acil Mod', emergency: true };
      setSession(em);
      setEmergencyMode(true);
    }
  }, [online, session, emergencyMode]);

  useEffect(() => {
    saveBuildings(rawBuildings);
  }, [rawBuildings]);

  useEffect(() => {
    saveZoneArrivals(zoneArrivals);
  }, [zoneArrivals]);

  useEffect(() => {
    savePhotoReports(photoReports);
  }, [photoReports]);

  useEffect(() => {
    if (!online || emergencyMode) return;
    if (zonesLoading || hospitalsLoading) return;

    const snap = () => {
      snapshotAppState({
        assemblyPoints,
        hospitals,
        buildings: rawBuildings,
        photoReports,
        zoneArrivals,
        mapCenter: MAP_CENTER,
        mapZoom: MAP_ZOOM,
      });
    };

    snap();
    snapshotTimer.current = setInterval(snap, 60000);
    return () => clearInterval(snapshotTimer.current);
  }, [
    online,
    emergencyMode,
    zonesLoading,
    hospitalsLoading,
    assemblyPoints,
    hospitals,
    rawBuildings,
    photoReports,
    zoneArrivals,
  ]);

  const handleAddBuilding = useCallback((formData) => {
    const raw = {
      id: `bina-${++idCounter}`,
      reportSource: 'user_panel',
      isEnkazSos: false,
      ...formData,
      createdAt: new Date().toISOString(),
    };
    setRawBuildings((prev) => [...prev, raw]);
  }, []);

  useEffect(() => {
    const reload = () => setRawBuildings(loadBuildings());
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) reload();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(BUILDINGS_UPDATED_EVENT, reload);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(BUILDINGS_UPDATED_EVENT, reload);
    };
  }, []);

  const handlePhotoReport = useCallback((payload) => {
    if (!payload?.geo || !payload?.analysis) return;
    setPhotoReports((prev) => [...prev, createPhotoReport(payload)]);
  }, []);

  const handleDeletePhotoReport = useCallback((id) => {
    setPhotoReports((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleDeleteBuilding = useCallback((id) => {
    setRawBuildings((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const handleZoneArrival = useCallback(({ zoneId, peopleCount }) => {
    const n = Math.max(1, Number(peopleCount) || 1);
    setZoneArrivals((prev) => [
      ...prev,
      {
        id: `ulasim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        zoneId: String(zoneId),
        peopleCount: n,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    clearEmergencySession();
    setSession(null);
    setEmergencyMode(false);
  }, []);

  const handleEmergencyMode = useCallback((emSession) => {
    setSession(emSession);
    setEmergencyMode(true);
  }, []);

  if (!session) {
    return (
      <div className="h-full afet-app">
        <LoginScreen onLogin={setSession} onEmergencyMode={handleEmergencyMode} />
      </div>
    );
  }

  if (emergencyMode || session.emergency) {
    return (
      <div className="h-full afet-app">
        <EmergencyModePlatform onExit={handleLogout} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col afet-app bg-slate-950">
      <Navbar session={session} onLogout={handleLogout} online={online} />
      {(zonesLoading || hospitalsLoading) && (
        <div className="shrink-0 px-4 py-1.5 bg-amber-950/40 text-center text-xs text-amber-200/90">
          {zonesLoading && 'AFAD toplanma alanları yükleniyor...'}
          {zonesLoading && hospitalsLoading && ' · '}
          {hospitalsLoading && 'Hastane konumları yükleniyor...'}
        </div>
      )}
      <main className="flex-1 min-h-0 flex flex-col">
        {platform === 'user' ? (
          <UserPlatform
            buildings={buildings}
            safeZones={safeZones}
            zonesByCity={zonesByCity}
            assemblyPoints={assemblyPoints}
            hospitals={hospitals}
            hospitalCount={hospitalCount}
            onAddBuilding={handleAddBuilding}
            onZoneArrival={handleZoneArrival}
          />
        ) : (
          <AuthorityPlatform
            buildings={buildings}
            safeZones={safeZones}
            zonesByCity={zonesByCity}
            assemblyPoints={assemblyPoints}
            hospitals={hospitals}
            hospitalCount={hospitalCount}
            hospitalsLoading={hospitalsLoading}
            hospitalsError={hospitalsError}
            zoneArrivals={zoneArrivals}
            photoReports={photoReports}
            onPhotoReportSaved={handlePhotoReport}
            onDeletePhotoReport={handleDeletePhotoReport}
            onDeleteBuilding={handleDeleteBuilding}
          />
        )}
      </main>
    </div>
  );
}
