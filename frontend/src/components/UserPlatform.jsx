import { useState, useMemo } from 'react';
import MapView from './MapView.jsx';
import BuildingForm from './BuildingForm.jsx';
import Chatbot from './Chatbot.jsx';
import SafeZonesByCityList from './SafeZonesByCityList.jsx';
import CityZoneFilter from './CityZoneFilter.jsx';
import { MAP_CENTER, MAP_ZOOM, MAP_ZOOM_LOCAL } from '../data/sampleData.js';
import { ALL_CITIES, filterZonesByCity } from '../utils/safeZonesByCity.js';

export default function UserPlatform({
  buildings,
  safeZones,
  zonesByCity,
  assemblyPoints,
  onAddBuilding,
}) {
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [nearestInfo, setNearestInfo] = useState(null);
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES);

  const filteredAssemblyPoints = useMemo(
    () => filterZonesByCity(assemblyPoints, selectedCity),
    [assemblyPoints, selectedCity]
  );

  const handleMapClick = (lat, lng) => {
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
          name: zone.name,
          il: zone.il,
          distanceKm: Math.round(dist * 100) / 100,
          lat: zone.lat,
          lng: zone.lng,
        };
      }
    }
    setNearestInfo(nearest);
  };

  const handleSubmit = (data) => {
    onAddBuilding(data);
    setSelectedCoords(null);
    setNearestInfo(null);
  };

  return (
    <>
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* HARİTA ÜSTTE — her zaman görünür */}
      <section className="shrink-0 p-4 pb-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🗺️</span> Harita
          </h2>
          <span className="text-xs px-2 py-1 rounded-full bg-sky-600/30 text-sky-300 border border-sky-500/40">
            Hasarlı binanın yerine tıkla
          </span>
        </div>
        <p className="text-sm text-slate-400 mb-2">
          Mavi işaret = seçtiğin konum. Mor noktalar = AFAD toplanma alanları (
          {selectedCity === ALL_CITIES
            ? assemblyPoints.length
            : `${filteredAssemblyPoints.length} / ${assemblyPoints.length}`}
          ).
        </p>
        {zonesByCity?.length > 0 && (
          <CityZoneFilter
            groups={zonesByCity}
            selectedCity={selectedCity}
            onSelectCity={setSelectedCity}
            totalCount={assemblyPoints.length}
            className="mb-3"
          />
        )}
        <div
          className="w-full rounded-xl overflow-hidden border-2 border-sky-600/50 shadow-lg shadow-sky-900/20"
          style={{ height: 'min(55vh, 520px)', minHeight: 320 }}
        >
          <MapView
            buildings={buildings}
            assemblyPoints={filteredAssemblyPoints}
            center={selectedCoords ? [selectedCoords.lat, selectedCoords.lng] : MAP_CENTER}
            zoom={selectedCoords ? MAP_ZOOM_LOCAL : MAP_ZOOM}
            onMapClick={handleMapClick}
            mapClickEnabled
            selectedPosition={selectedCoords}
          />
        </div>
      </section>

      {/* FORM ALTA */}
      <section className="flex-1 p-4 pt-2 lg:overflow-y-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BuildingForm
            onSubmit={handleSubmit}
            selectedCoords={selectedCoords}
            onClearCoords={() => {
              setSelectedCoords(null);
              setNearestInfo(null);
            }}
          />

          <div className="space-y-4">
            {nearestInfo && (
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/50">
                <p className="text-sm font-medium text-indigo-200">En yakın güvenli bölge</p>
                <p className="text-lg font-bold text-white mt-1">{nearestInfo.name}</p>
                {nearestInfo.il && (
                  <p className="text-xs text-slate-400">{nearestInfo.il}</p>
                )}
                <p className="text-xs text-indigo-300 mt-1">
                  ≈ {nearestInfo.distanceKm} km uzaklıkta
                </p>
              </div>
            )}

            <SafeZonesByCityList
              safeZones={safeZones}
              zonesByCity={zonesByCity}
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
            />
          </div>
        </div>
      </section>
    </div>

    <Chatbot
      safeZones={safeZones}
      zonesByCity={zonesByCity}
      selectedCoords={selectedCoords}
      nearestInfo={nearestInfo}
    />
    </>
  );
}
