import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DisasterMap from '../components/DisasterMap';
import type { Building, SafeZone } from '../types';

interface Assignment {
  buildingId: string;
  buildingName: string;
  address: string;
  lat: number;
  lng: number;
  occupants: number;
  damageLevel: string;
  safeZoneId: string;
  safeZoneName: string;
  distanceKm: number;
}

interface AidEstimate {
  safeZoneId: string;
  safeZoneName: string;
  assignedBuildings: number;
  totalEvacuees: number;
  capacity: number;
  utilizationPercent: number;
  recommended: { waterLiters: number; foodPortions: number; medicalKits: number; blankets: number };
  deficit: { water: number; food: number; medical: number; blankets: number };
}

export default function Evacuation() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unassigned, setUnassigned] = useState<Assignment[]>([]);
  const [aidEstimates, setAidEstimates] = useState<AidEstimate[]>([]);

  useEffect(() => {
    Promise.all([
      api<{ buildings: Building[] }>('/buildings'),
      api<{ zones: SafeZone[] }>('/zones'),
      api<{
        assignments: Assignment[];
        unassigned: Assignment[];
        aidEstimates: AidEstimate[];
      }>('/analysis/evacuation'),
    ]).then(([b, z, plan]) => {
      setBuildings(b.buildings);
      setZones(z.zones);
      setAssignments(plan.assignments);
      setUnassigned(plan.unassigned);
      setAidEstimates(plan.aidEstimates);
    });
  }, []);

  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const evacuationLines = assignments
    .filter((a) => a.safeZoneId)
    .map((a) => {
      const zone = zoneMap.get(a.safeZoneId);
      if (!zone) return null;
      return {
        from: [a.lat, a.lng] as [number, number],
        to: [zone.lat, zone.lng] as [number, number],
        buildingName: a.buildingName,
        zoneName: a.safeZoneName,
      };
    })
    .filter(Boolean) as Array<{
    from: [number, number];
    to: [number, number];
    buildingName: string;
    zoneName: string;
  }>;

  return (
    <div className="h-full flex flex-col lg:flex-row">
      <div className="lg:w-1/2 p-4 min-h-[300px] lg:min-h-0 flex flex-col">
        <h2 className="text-xl font-bold mb-1">Tahliye Planı</h2>
        <p className="text-sm text-slate-400 mb-3">
          Hasarlı binalar → en yakın güvenli bölge (kapasiteye göre)
        </p>
        <div className="flex-1 min-h-[280px]">
          <DisasterMap
            buildings={buildings}
            zones={zones}
            evacuationLines={evacuationLines}
            height="100%"
          />
        </div>
      </div>

      <div className="lg:w-1/2 p-4 overflow-y-auto border-t lg:border-t-0 lg:border-l border-slate-800">
        <h3 className="font-semibold mb-3">Atamalar ({assignments.length})</h3>
        <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
          {assignments.map((a) => (
            <div key={a.buildingId} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-sm">
              <p className="font-medium">{a.buildingName}</p>
              <p className="text-slate-400">
                → {a.safeZoneName} ({a.distanceKm} km) · {a.occupants} kişi
              </p>
            </div>
          ))}
        </div>

        {unassigned.length > 0 && (
          <>
            <h3 className="font-semibold text-red-400 mb-2">
              Atanamayan ({unassigned.length})
            </h3>
            <div className="space-y-2 mb-6">
              {unassigned.map((a) => (
                <div key={a.buildingId} className="p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-sm">
                  {a.buildingName} — kapasite yetersiz
                </div>
              ))}
            </div>
          </>
        )}

        <h3 className="font-semibold mb-3">Yardım İhtiyacı (Bölge Bazlı)</h3>
        <div className="space-y-3">
          {aidEstimates.map((z) => (
            <div key={z.safeZoneId} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium">{z.safeZoneName}</p>
                <span className="text-xs px-2 py-0.5 rounded bg-teal-900/50 text-teal-300">
                  %{z.utilizationPercent} dolu
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-2">
                {z.totalEvacuees} tahliye · {z.assignedBuildings} bina
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span>💧 Su: +{z.deficit.water}L</span>
                <span>🍞 Gıda: +{z.deficit.food}</span>
                <span>🩹 Tıbbi: +{z.deficit.medical}</span>
                <span>🛏️ Battaniye: +{z.deficit.blankets}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
