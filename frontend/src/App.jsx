import { useState, useMemo, useCallback, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import UserPlatform from './components/UserPlatform.jsx';
import AuthorityPlatform from './components/AuthorityPlatform.jsx';
import { STORAGE_KEY } from './data/sampleData.js';
import { enrichAllBuildings } from './utils/buildingEnricher.js';
import { sortByRisk } from './utils/riskCalculator.js';
import { useAssemblyPoints, toSafeZones } from './hooks/useAssemblyPoints.js';
import { useHospitals } from './hooks/useHospitals.js';
import { groupSafeZonesByCity } from './utils/safeZonesByCity.js';
import {
  loadZoneArrivals,
  saveZoneArrivals,
} from './utils/zoneArrivals.js';
import {
  loadPhotoReports,
  savePhotoReports,
  createPhotoReport,
} from './utils/photoDamageStorage.js';

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
  const [platform, setPlatform] = useState('user');
  const {
    assemblyPoints,
    loading: zonesLoading,
    count: zoneCount,
    provinces: zoneProvinces,
    isPartialCoverage,
  } = useAssemblyPoints();
  const { hospitals, loading: hospitalsLoading, count: hospitalCount } = useHospitals();
  const safeZones = useMemo(() => toSafeZones(assemblyPoints), [assemblyPoints]);
  const zonesByCity = useMemo(() => groupSafeZonesByCity(safeZones), [safeZones]);
  const [rawBuildings, setRawBuildings] = useState(loadBuildings);
  const [zoneArrivals, setZoneArrivals] = useState(loadZoneArrivals);
  const [photoReports, setPhotoReports] = useState(loadPhotoReports);

  const buildings = useMemo(
    () => sortByRisk(enrichAllBuildings(rawBuildings, safeZones)),
    [rawBuildings, safeZones]
  );

  useEffect(() => {
    saveBuildings(rawBuildings);
  }, [rawBuildings]);

  useEffect(() => {
    saveZoneArrivals(zoneArrivals);
  }, [zoneArrivals]);

  useEffect(() => {
    savePhotoReports(photoReports);
  }, [photoReports]);

  const handleAddBuilding = useCallback((formData) => {
    const raw = {
      id: `bina-${++idCounter}`,
      ...formData,
      createdAt: new Date().toISOString(),
    };
    setRawBuildings((prev) => [...prev, raw]);
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

  return (
    <div className="h-full flex flex-col bg-slate-950">
      <Navbar activePlatform={platform} onPlatformChange={setPlatform} />
      {(zonesLoading || hospitalsLoading) && (
        <div className="shrink-0 px-4 py-1.5 bg-indigo-950/50 text-center text-xs text-indigo-300">
          {zonesLoading && 'AFAD toplanma alanları yükleniyor...'}
          {zonesLoading && hospitalsLoading && ' · '}
          {hospitalsLoading && 'Hastane konumları yükleniyor...'}
        </div>
      )}
      {!zonesLoading && zoneCount > 0 && (
        <div className="shrink-0 px-4 py-2 bg-amber-950/50 text-center text-xs text-amber-100/90 border-b border-amber-900/40 space-y-0.5">
          <p>
            🛡️ Haritada {zoneCount.toLocaleString('tr-TR')} AFAD toplanma alanı (
            {zoneProvinces.length} il: {zoneProvinces.slice(0, 6).join(', ')}
            {zoneProvinces.length > 6 ? '…' : ''})
          </p>
          {isPartialCoverage && (
            <p className="text-amber-200/70">
              Marmara, Ege ve Akdeniz (İstanbul, İzmir, Balıkesir, Antalya vb.) bu veri setinde yok —
              kaynak yalnızca deprem bölgesi illerini içeriyor. Güncel sorgu:{' '}
              <a
                href="https://www.turkiye.gov.tr/afet-ve-acil-durum-yonetimi-acil-toplanma-alani-sorgulama"
                target="_blank"
                rel="noreferrer"
                className="underline text-amber-100"
              >
                turkiye.gov.tr
              </a>
            </p>
          )}
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
