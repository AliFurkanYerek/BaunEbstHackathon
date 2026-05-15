import { useState, useMemo, useCallback, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import UserPlatform from './components/UserPlatform.jsx';
import AuthorityPlatform from './components/AuthorityPlatform.jsx';
import { STORAGE_KEY } from './data/sampleData.js';
import { enrichAllBuildings } from './utils/buildingEnricher.js';
import { sortByRisk } from './utils/riskCalculator.js';
import { useAssemblyPoints, toSafeZones } from './hooks/useAssemblyPoints.js';
import { groupSafeZonesByCity } from './utils/safeZonesByCity.js';

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
  const safeZones = useMemo(() => toSafeZones(assemblyPoints), [assemblyPoints]);
  const zonesByCity = useMemo(() => groupSafeZonesByCity(safeZones), [safeZones]);
  const [rawBuildings, setRawBuildings] = useState(loadBuildings);

  const buildings = useMemo(
    () => sortByRisk(enrichAllBuildings(rawBuildings, safeZones)),
    [rawBuildings, safeZones]
  );

  useEffect(() => {
    saveBuildings(rawBuildings);
  }, [rawBuildings]);

  const handleAddBuilding = useCallback((formData) => {
    const raw = {
      id: `bina-${++idCounter}`,
      ...formData,
      createdAt: new Date().toISOString(),
    };
    setRawBuildings((prev) => [...prev, raw]);
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-950">
      <Navbar activePlatform={platform} onPlatformChange={setPlatform} />
      {zonesLoading && (
        <div className="shrink-0 px-4 py-1.5 bg-indigo-950/50 text-center text-xs text-indigo-300">
          AFAD toplanma alanları yükleniyor...
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
            onAddBuilding={handleAddBuilding}
          />
        ) : (
          <AuthorityPlatform
            buildings={buildings}
            safeZones={safeZones}
            zonesByCity={zonesByCity}
            assemblyPoints={assemblyPoints}
          />
        )}
      </main>
    </div>
  );
}
