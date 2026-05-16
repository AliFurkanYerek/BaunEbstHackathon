import { useState, useMemo, useCallback } from 'react';
import MapView from './MapView.jsx';
import BuildingForm from './BuildingForm.jsx';
import Chatbot from './Chatbot.jsx';
import BottomAssemblyPanel from './BottomAssemblyPanel.jsx';
import CityZoneFilter from './CityZoneFilter.jsx';
import MapLayerFilter from './MapLayerFilter.jsx';
import { MAP_LAYER_ALL, USER_MAP_LAYERS } from '../utils/mapLayerFilter.js';
import { MAP_CENTER, MAP_ZOOM, MAP_ZOOM_LOCAL } from '../data/sampleData.js';
import { ALL_CITIES, filterZonesByCity } from '../utils/safeZonesByCity.js';
import { findNearestSafeZone, findNearestHospital } from '../utils/distanceCalculator.js';
import { fetchWalkingRoute, straightLineRoute, formatRouteSummary } from '../utils/osrmRoute.js';

export default function UserPlatform({
  buildings,
  safeZones,
  zonesByCity,
  assemblyPoints,
  hospitals = [],
  hospitalCount = 0,
  onAddBuilding,
  onZoneArrival,
}) {
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [nearestInfo, setNearestInfo] = useState(null);
  const [nearestHospitalInfo, setNearestHospitalInfo] = useState(null);
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES);
  const [mapLayer, setMapLayer] = useState(MAP_LAYER_ALL);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const filteredAssemblyPoints = useMemo(
    () => filterZonesByCity(assemblyPoints, selectedCity),
    [assemblyPoints, selectedCity]
  );

  const filteredHospitals = useMemo(
    () => filterZonesByCity(hospitals, selectedCity),
    [hospitals, selectedCity]
  );

  const showRouteToSafeZone = useCallback(async () => {
    if (!selectedCoords) {
      return { ok: false, error: 'Önce haritada konumunuzu işaretleyin (mavi pin).' };
    }
    const zones = assemblyPoints?.length ? assemblyPoints : safeZones;
    const zone =
      nearestInfo ||
      findNearestSafeZone(selectedCoords.lat, selectedCoords.lng, zones);
    if (!zone?.lat || !zone?.lng) {
      return { ok: false, error: 'Yakın güvenli bölge bulunamadı.' };
    }

    const from = selectedCoords;
    const to = { lat: zone.lat, lng: zone.lng };
    setRouteLoading(true);
    try {
      let routeData;
      try {
        routeData = await fetchWalkingRoute(from, to);
      } catch {
        routeData = straightLineRoute(from, to);
      }
      setNavigationRoute({
        positions: routeData.positions,
        distanceM: routeData.distanceM,
        durationS: routeData.durationS,
        source: routeData.source,
        destinationName: zone.name,
        routeKind: 'safe',
        to,
      });
      return {
        ok: true,
        zoneName: zone.name,
        summary: formatRouteSummary(routeData.distanceM, routeData.durationS),
        isEstimate: routeData.source === 'straight',
      };
    } finally {
      setRouteLoading(false);
    }
  }, [selectedCoords, nearestInfo, assemblyPoints, safeZones]);

  const showRouteToHospital = useCallback(async () => {
    if (!selectedCoords) {
      return { ok: false, error: 'Önce haritada konumunuzu işaretleyin (mavi pin).' };
    }
    const list = filteredHospitals.length ? filteredHospitals : hospitals;
    const hospital =
      nearestHospitalInfo || findNearestHospital(selectedCoords.lat, selectedCoords.lng, list);
    if (!hospital?.lat || !hospital?.lng) {
      return { ok: false, error: 'Yakın hastane bulunamadı.' };
    }

    const from = selectedCoords;
    const to = { lat: hospital.lat, lng: hospital.lng };
    setRouteLoading(true);
    try {
      let routeData;
      try {
        routeData = await fetchWalkingRoute(from, to);
      } catch {
        routeData = straightLineRoute(from, to);
      }
      setNavigationRoute({
        positions: routeData.positions,
        distanceM: routeData.distanceM,
        durationS: routeData.durationS,
        source: routeData.source,
        destinationName: hospital.name,
        routeKind: 'hospital',
        to,
      });
      return {
        ok: true,
        hospitalName: hospital.name,
        summary: formatRouteSummary(routeData.distanceM, routeData.durationS),
        isEstimate: routeData.source === 'straight',
      };
    } finally {
      setRouteLoading(false);
    }
  }, [selectedCoords, nearestHospitalInfo, filteredHospitals, hospitals]);

  const handleMapClick = (lat, lng) => {
    setNavigationRoute(null);
    setSelectedCoords({ lat, lng });

    let nearest = null;
    let minDist = Infinity;
    const zonesForNearest = assemblyPoints?.length ? assemblyPoints : safeZones;
    for (const zone of zonesForNearest) {
      const R = 6371;
      const dLat = ((zone.lat - lat) * Math.PI) / 180;
      const dLng = ((zone.lng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((zone.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist < minDist) {
        minDist = dist;
        nearest = {
          id: zone.id,
          name: zone.name,
          il: zone.il,
          distanceKm: Math.round(dist * 100) / 100,
          lat: zone.lat,
          lng: zone.lng,
        };
      }
    }
    setNearestInfo(nearest);

    const hospitalList = filteredHospitals.length ? filteredHospitals : hospitals;
    const nearestH = findNearestHospital(lat, lng, hospitalList);
    setNearestHospitalInfo(
      nearestH
        ? {
            id: nearestH.id,
            name: nearestH.name,
            il: nearestH.il,
            distanceKm: nearestH.distanceKm,
            lat: nearestH.lat,
            lng: nearestH.lng,
          }
        : null
    );
  };

  const handleSubmit = (data) => {
    onAddBuilding(data);
    setSelectedCoords(null);
    setNearestInfo(null);
    setNearestHospitalInfo(null);
  };

  return (
    <>
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="text-xl">🗺️</span> Harita — konum seçin
          </h3>
          <span className="text-xs px-2 py-1 rounded-full bg-sky-600/30 text-sky-300 border border-sky-500/40">
            Hasarlı binanın yerine tıkla
          </span>
        </div>
        {navigationRoute && (
          <p className="text-sm text-cyan-300 mb-2 flex flex-wrap items-center gap-2">
            <span>
              🧭 Haritada{' '}
              <strong className="text-cyan-200">{navigationRoute.destinationName}</strong>
              yönünde{' '}
              {navigationRoute.source === 'straight' ? 'tahmini' : 'yürüyüş'} rotası
              {navigationRoute.distanceM != null &&
                ` (${formatRouteSummary(navigationRoute.distanceM, navigationRoute.durationS)})`}
            </span>
            <button
              type="button"
              onClick={() => setNavigationRoute(null)}
              className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700"
            >
              Rotayı kaldır
            </button>
          </p>
        )}
        {routeLoading && (
          <p className="text-sm text-slate-400 mb-2 animate-pulse">Rota hesaplanıyor…</p>
        )}
        <p className="text-xs text-slate-500 mb-2">
          Mavi pin = seçtiğin konum · Mor = güvenli bölge · Kırmızı + = hastane · Renkli nokta =
          bildirimler (Tümü katmanında)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <MapLayerFilter
            options={USER_MAP_LAYERS}
            selectedLayer={mapLayer}
            onSelectLayer={setMapLayer}
          />
          {zonesByCity?.length > 0 && (
            <CityZoneFilter
              groups={zonesByCity}
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              totalCount={assemblyPoints.length}
            />
          )}
        </div>
        <div
          className="w-full rounded-xl overflow-hidden border border-slate-800"
          style={{ height: 500 }}
        >
          <MapView
            buildings={buildings}
            assemblyPoints={filteredAssemblyPoints}
            hospitals={filteredHospitals}
            mapLayer={mapLayer}
            center={selectedCoords ? [selectedCoords.lat, selectedCoords.lng] : MAP_CENTER}
            zoom={selectedCoords ? MAP_ZOOM_LOCAL : MAP_ZOOM}
            onMapClick={handleMapClick}
            mapClickEnabled
            selectedPosition={selectedCoords}
            navigationRoute={navigationRoute}
          />
        </div>
      </section>

      <BuildingForm
        onSubmit={handleSubmit}
        selectedCoords={selectedCoords}
        onClearCoords={() => {
          setSelectedCoords(null);
          setNearestInfo(null);
          setNearestHospitalInfo(null);
          setNavigationRoute(null);
        }}
      />

      {nearestInfo && (
        <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/50">
          <p className="text-sm font-medium text-indigo-200">En yakın güvenli bölge</p>
          <p className="text-lg font-bold text-white mt-1">{nearestInfo.name}</p>
          {nearestInfo.il && <p className="text-xs text-slate-400">{nearestInfo.il}</p>}
          <p className="text-xs text-indigo-300 mt-1">
            ≈ {nearestInfo.distanceKm} km uzaklıkta
          </p>
        </div>
      )}

      <BottomAssemblyPanel
        safeZones={safeZones}
        zonesByCity={zonesByCity}
        onArrival={onZoneArrival}
      />
    </div>

    <Chatbot
      safeZones={safeZones}
      zonesByCity={zonesByCity}
      hospitals={hospitals}
      selectedCoords={selectedCoords}
      nearestInfo={nearestInfo}
      nearestHospital={nearestHospitalInfo}
      onShowRouteToNearest={showRouteToSafeZone}
      onShowRouteToNearestHospital={showRouteToHospital}
    />
    </>
  );
}
