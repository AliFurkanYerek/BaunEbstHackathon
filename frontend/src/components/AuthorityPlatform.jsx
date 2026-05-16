import { useMemo, useState, useCallback } from 'react';
import AmbulanceRoutePlanner from './AmbulanceRoutePlanner.jsx';
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
  hospitalsLoading = false,
  hospitalsError = null,
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
  const [navigationRoutes, setNavigationRoutes] = useState(null);
  const [routeMeta, setRouteMeta] = useState(null);
  const [incidentHighlight, setIncidentHighlight] = useState(null);
  const [mapPickMode, setMapPickMode] = useState(null);
  const [customDestination, setCustomDestination] = useState(null);

  const handleRouteReady = useCallback((result) => {
    if (!result?.routes?.length) {
      setNavigationRoutes(null);
      setRouteMeta(null);
      return;
    }
    setNavigationRoutes(result.routes);
    setRouteMeta(result);
  }, []);

  const clearRoute = useCallback(() => {
    setNavigationRoutes(null);
    setRouteMeta(null);
  }, []);

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

      <AmbulanceRoutePlanner
        buildings={buildings}
        photoReports={photoReports}
        hospitals={hospitals}
        hospitalsLoading={hospitalsLoading}
        hospitalsError={hospitalsError}
        onRouteReady={handleRouteReady}
        onHighlightIncident={setIncidentHighlight}
        mapPickMode={mapPickMode}
        customDestination={customDestination}
        onClearCustomDestination={() => setCustomDestination(null)}
        onRequestMapPick={(mode) => setMapPickMode(mode)}
      />

      <RiskAggregationPanel buildings={buildings} photoReports={photoReports} />

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-6">
        <SafeZoneDistribution
          distribution={mergedDistribution}
          safeZones={safeZones}
          zonesByCity={zonesByCity}
          selectedCity={selectedCity}
          onSelectCity={setSelectedCity}
          totalZoneCount={assemblyPoints.length}
        />
      </div>

      <section>
        <h3 className="font-semibold text-white mb-2">Operasyon Haritası</h3>
        {mapPickMode && (
          <p className="text-sm text-sky-200 mb-2 bg-sky-950/40 border border-sky-800/50 rounded-lg px-3 py-2">
            Haritaya tıklayın:{' '}
            hedef nokta
            <button
              type="button"
              onClick={() => setMapPickMode(null)}
              className="ml-3 underline text-slate-300"
            >
              İptal
            </button>
          </p>
        )}
        {navigationRoutes?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
            <span className="text-rose-200">
              🚑 <strong>{routeMeta?.ambulanceCount ?? 1}</strong> ambulans ·{' '}
              <strong>{routeMeta?.originName}</strong> → <strong>{routeMeta?.destinationName}</strong>
              {routeMeta?.summary && (
                <span className="text-emerald-300 ml-2">({routeMeta.summary})</span>
              )}
            </span>
            <button
              type="button"
              onClick={clearRoute}
              className="px-2 py-0.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Rotayı kaldır
            </button>
          </div>
        )}
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
            highlightPhotoLocation={incidentHighlight || damagePhotoGeo}
            photoReports={photoReports}
            navigationRoutes={navigationRoutes}
            routeHazards={
              routeMeta?.simpleRoute ? null : routeMeta?.avoidHazards ?? routeMeta?.hazards
            }
            incidentTarget={routeMeta?.simpleRoute ? null : routeMeta?.to}
            mapClickEnabled={Boolean(mapPickMode)}
            onMapClick={(lat, lng) => {
              if (mapPickMode === 'dest') {
                setCustomDestination({ lat, lng, name: 'Harita hedefi' });
                setMapPickMode(null);
              }
            }}
          />
        </div>
      </section>
    </div>
  );
}
