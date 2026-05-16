import { useState, useMemo, useCallback } from 'react';
import MapView from './MapView.jsx';
import EmergencySirenButton from './EmergencySirenButton.jsx';
import { MAP_LAYER_ALL } from '../utils/mapLayerFilter.js';
import { getEmergencyMapData, saveOfflineSnapshot } from '../utils/offlineCache.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { STORAGE_KEY } from '../data/sampleData.js';

export default function EmergencyModePlatform({ onExit }) {
  const online = useOnlineStatus();
  const [data, setData] = useState(() => getEmergencyMapData());
  const [mapClick, setMapClick] = useState(null);

  const refreshData = useCallback(() => {
    setData(getEmergencyMapData());
  }, []);

  const buildings = useMemo(() => data.buildings || [], [data.buildings]);
  const safeZones = useMemo(
    () =>
      (data.assemblyPoints || []).map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        capacity: p.capacity,
        il: p.il,
        ilce: p.ilce,
      })),
    [data.assemblyPoints]
  );

  const handleMapClick = (lat, lng) => {
    setMapClick({ lat, lng });
  };

  const addLocalSos = () => {
    if (!mapClick) return;
    const raw = {
      id: `sos-${Date.now()}`,
      lat: mapClick.lat,
      lng: mapClick.lng,
      damageLevel: 5,
      emergencyTypes: ['enkaz'],
      peopleCount: 1,
      createdAt: new Date().toISOString(),
      note: 'Acil mod SOS',
    };
    const list = [...buildings, raw];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    saveOfflineSnapshot({ ...data, buildings: list });
    refreshData();
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white">
      <header className="shrink-0 border-b border-red-900/50 bg-red-950/40 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span aria-hidden>🆘</span> Acil mod — internetsiz
          </h1>
          <p className="text-xs text-red-200/80 mt-0.5">
            {online ? (
              <span className="text-amber-300">Çevrimiçi — önbellek güncelleniyor</span>
            ) : (
              <span className="text-red-300 font-semibold">Çevrimdışı — önbellek haritası</span>
            )}
            {data.savedAt && (
              <span className="text-slate-400 ml-2">
                Son kayıt: {new Date(data.savedAt).toLocaleString('tr-TR')}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm hover:bg-slate-800"
        >
          Çıkış
        </button>
      </header>

      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 px-3 py-2 bg-slate-900/90 text-xs text-slate-300 flex flex-wrap gap-2 items-center">
          <span>
            Önbellek: {data.assemblyPoints?.length ?? 0} toplanma · {data.hospitals?.length ?? 0}{' '}
            hastane
          </span>
          <button type="button" onClick={refreshData} className="text-sky-400 underline">
            Yenile
          </button>
          {mapClick && (
            <button type="button" onClick={addLocalSos} className="text-rose-400 font-semibold">
              SOS kaydet
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <MapView
            buildings={buildings}
            safeZones={safeZones}
            assemblyPoints={data.assemblyPoints || []}
            hospitals={data.hospitals || []}
            photoReports={data.photoReports || []}
            center={data.mapCenter}
            zoom={data.mapZoom}
            mapLayer={MAP_LAYER_ALL}
            mapClickEnabled
            onMapClick={handleMapClick}
            selectedPosition={mapClick}
            showRiskHeat
            offlineMode
          />
        </div>
        <EmergencySirenButton />
      </main>
    </div>
  );
}
