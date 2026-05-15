import { useMemo, useState } from 'react';
import SummaryCards from './SummaryCards.jsx';
import RiskTable from './RiskTable.jsx';
import SafeZoneDistribution from './SafeZoneDistribution.jsx';
import MapView from './MapView.jsx';
import CityZoneFilter from './CityZoneFilter.jsx';
import BuildingDamageAnalyzer from './BuildingDamageAnalyzer.jsx';
import { calculateTotalAid } from '../utils/aidCalculator.js';
import { sortByRisk, countCriticalBuildings } from '../utils/riskCalculator.js';
import { allocateBuildingsToSafeZones, mergeArrivalsIntoDistribution } from '../utils/safeZoneAllocator.js';
import { MAP_CENTER, MAP_ZOOM } from '../data/sampleData.js';
import { ALL_CITIES, filterZonesByCity } from '../utils/safeZonesByCity.js';
import { arrivalsByZoneId, totalArrivalPeopleCount } from '../utils/zoneArrivals.js';

export default function AuthorityPlatform({ buildings, safeZones, zonesByCity, assemblyPoints, zoneArrivals = [] }) {
  const arrivalsMap = useMemo(() => arrivalsByZoneId(zoneArrivals), [zoneArrivals]);
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES);

  const filteredAssemblyPoints = useMemo(
    () => filterZonesByCity(assemblyPoints, selectedCity),
    [assemblyPoints, selectedCity]
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

      <BuildingDamageAnalyzer />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RiskTable buildings={sortedBuildings} />
        <SafeZoneDistribution distribution={mergedDistribution} safeZones={safeZones} />
      </div>

      <section>
        <h3 className="font-semibold text-white mb-2">Operasyon Haritası</h3>
        <p className="text-xs text-slate-500 mb-2">
          Hasarlı binalar, güvenli bölgeler ve yüksek risk yoğunluğu
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
        <div className="w-full rounded-xl overflow-hidden border border-slate-800" style={{ height: 500 }}>
          <MapView
            buildings={sortedBuildings}
            assemblyPoints={filteredAssemblyPoints}
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            showRiskHeat
          />
        </div>
      </section>
    </div>
  );
}
