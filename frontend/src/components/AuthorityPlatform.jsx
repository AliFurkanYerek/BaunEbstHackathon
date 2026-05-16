import { useMemo, useState } from 'react';
import SummaryCards from './SummaryCards.jsx';
import RiskAggregationPanel from './RiskAggregationPanel.jsx';
import SafeZoneDistribution from './SafeZoneDistribution.jsx';
import MapView from './MapView.jsx';
import CityZoneFilter from './CityZoneFilter.jsx';
import MapLayerFilter from './MapLayerFilter.jsx';
import {
  MAP_LAYER_ALL,
  MAP_LAYER_REPORTS,
  AUTHORITY_MAP_LAYERS,
} from '../utils/mapLayerFilter.js';
import BuildingDamageAnalyzer from './BuildingDamageAnalyzer.jsx';
import AuthorityRecordManager from './AuthorityRecordManager.jsx';
import { calculateTotalAid } from '../utils/aidCalculator.js';
import { sortByRisk, countCriticalBuildings } from '../utils/riskCalculator.js';
import { allocateBuildingsToSafeZones, mergeArrivalsIntoDistribution } from '../utils/safeZoneAllocator.js';
import { MAP_CENTER, MAP_ZOOM } from '../data/sampleData.js';
import { ALL_CITIES, filterZonesByCity } from '../utils/safeZonesByCity.js';
import { arrivalsByZoneId, totalArrivalPeopleCount } from '../utils/zoneArrivals.js';

export default function AuthorityPlatform({
  buildings,
  safeZones,
  zonesByCity,
  assemblyPoints,
  hospitals = [],
  hospitalCount = 0,
  zoneArrivals = [],
  photoReports = [],
  onPhotoReportSaved,
  onDeletePhotoReport,
  onDeleteBuilding,
}) {
  const arrivalsMap = useMemo(() => arrivalsByZoneId(zoneArrivals), [zoneArrivals]);
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES);
  const [mapLayer, setMapLayer] = useState(MAP_LAYER_ALL);
  const [damagePhotoGeo, setDamagePhotoGeo] = useState(null);

  const handleDeletePhoto = (id) => {
    const removed = photoReports.find((p) => p.id === id);
    onDeletePhotoReport?.(id);
    if (removed && damagePhotoGeo) {
      const same =
        Math.abs(damagePhotoGeo.lat - removed.lat) < 1e-5 &&
        Math.abs(damagePhotoGeo.lng - removed.lng) < 1e-5;
      if (same) setDamagePhotoGeo(null);
    }
  };

  const filteredAssemblyPoints = useMemo(
    () => filterZonesByCity(assemblyPoints, selectedCity),
    [assemblyPoints, selectedCity]
  );

  const filteredHospitals = useMemo(
    () => filterZonesByCity(hospitals, selectedCity),
    [hospitals, selectedCity]
  );
  const sortedBuildings = useMemo(() => sortByRisk(buildings), [buildings]);

  const totalAid = useMemo(() => calculateTotalAid(buildings), [buildings]);

  const { distribution } = useMemo(
    () => allocateBuildingsToSafeZones(buildings, safeZones),
    [buildings, safeZones]
  );

  const mergedDistribution = useMemo(
    () => mergeArrivalsIntoDistribution(distribution, arrivalsMap),
    [distribution, arrivalsMap]
  );

  const arrivalPeople = useMemo(() => totalArrivalPeopleCount(zoneArrivals), [zoneArrivals]);

  const stats = useMemo(
    () => ({
      buildingCount: buildings.length,
      totalPeople: totalAid.people,
      totalWater: totalAid.water,
      totalFood: totalAid.food,
      totalBlankets: totalAid.blankets,
      criticalCount: countCriticalBuildings(buildings, 150),
      arrivalPeople,
    }),
    [buildings, totalAid, arrivalPeople]
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <SummaryCards stats={stats} />

      <BuildingDamageAnalyzer
        onPhotoLocated={(loc) => {
          setDamagePhotoGeo(loc);
          if (loc) setMapLayer(MAP_LAYER_REPORTS);
        }}
        onPhotoReportSaved={(payload) => {
          onPhotoReportSaved?.(payload);
          if (payload?.geo) setMapLayer(MAP_LAYER_REPORTS);
        }}
      />

      <AuthorityRecordManager
        buildings={buildings}
        photoReports={photoReports}
        onDeletePhoto={handleDeletePhoto}
        onDeleteBuilding={onDeleteBuilding}
      />

      <RiskAggregationPanel buildings={buildings} photoReports={photoReports} />

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-6">
        <SafeZoneDistribution distribution={mergedDistribution} safeZones={safeZones} />
      </div>

      <section>
        <h3 className="font-semibold text-white mb-2">Operasyon Haritası</h3>
        <p className="text-xs text-slate-500 mb-2">
          Katman seçin: güvenli bölge, hastane,{' '}
          <strong className="text-orange-300">bildirilenler</strong> (turuncu E = fotoğraf/enkaz,
          renkli nokta = kullanıcı bildirimi) veya tümü.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <MapLayerFilter
            options={AUTHORITY_MAP_LAYERS}
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
        <div className="w-full rounded-xl overflow-hidden border border-slate-800" style={{ height: 500 }}>
          <MapView
            buildings={sortedBuildings}
            assemblyPoints={filteredAssemblyPoints}
            hospitals={filteredHospitals}
            mapLayer={mapLayer}
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            showRiskHeat
            highlightPhotoLocation={damagePhotoGeo}
            photoReports={photoReports}
          />
        </div>
      </section>
    </div>
  );
}
