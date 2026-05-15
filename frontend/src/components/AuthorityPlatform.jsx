import { useMemo } from 'react';
import SummaryCards from './SummaryCards.jsx';
import RiskTable from './RiskTable.jsx';
import SafeZoneDistribution from './SafeZoneDistribution.jsx';
import MapView from './MapView.jsx';
import { calculateTotalAid } from '../utils/aidCalculator.js';
import { sortByRisk, countCriticalBuildings } from '../utils/riskCalculator.js';
import { allocateBuildingsToSafeZones } from '../utils/safeZoneAllocator.js';
import { MAP_CENTER, MAP_ZOOM } from '../data/sampleData.js';

export default function AuthorityPlatform({ buildings, safeZones, assemblyPoints }) {
  const sortedBuildings = useMemo(() => sortByRisk(buildings), [buildings]);

  const totalAid = useMemo(() => calculateTotalAid(buildings), [buildings]);

  const { distribution } = useMemo(
    () => allocateBuildingsToSafeZones(buildings, safeZones),
    [buildings, safeZones]
  );

  const stats = useMemo(
    () => ({
      buildingCount: buildings.length,
      totalPeople: totalAid.people,
      totalWater: totalAid.water,
      totalFood: totalAid.food,
      totalBlankets: totalAid.blankets,
      criticalCount: countCriticalBuildings(buildings, 150),
    }),
    [buildings, totalAid]
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <SummaryCards stats={stats} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RiskTable buildings={sortedBuildings} />
        <SafeZoneDistribution distribution={distribution} />
      </div>

      <section>
        <h3 className="font-semibold text-white mb-2">Operasyon Haritası</h3>
        <p className="text-xs text-slate-500 mb-3">
          Hasarlı binalar, güvenli bölgeler ve yüksek risk yoğunluğu
        </p>
        <div className="w-full rounded-xl overflow-hidden border border-slate-800" style={{ height: 500 }}>
          <MapView
            buildings={sortedBuildings}
            assemblyPoints={assemblyPoints}
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            showRiskHeat
          />
        </div>
      </section>
    </div>
  );
}
