import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Building, SafeZone } from '../types';
import DisasterMap from '../components/DisasterMap';
import { damageLabel, DAMAGE_COLORS } from '../utils/damage';
import type { DamageLevel } from '../types';

export default function MapPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [zones, setZones] = useState<SafeZone[]>([]);

  useEffect(() => {
    Promise.all([
      api<{ buildings: Building[] }>('/buildings'),
      api<{ zones: SafeZone[] }>('/zones'),
    ]).then(([b, z]) => {
      setBuildings(b.buildings);
      setZones(z.zones);
    });
  }, []);

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-slate-800 shrink-0">
        <h2 className="text-xl font-bold">Afet Haritası</h2>
        <p className="text-sm text-slate-400">
          Binalar, güvenli bölgeler ve hasar durumu
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          {(Object.keys(DAMAGE_COLORS) as DamageLevel[]).map((level) => (
            <span key={level} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: DAMAGE_COLORS[level] }}
              />
              {damageLabel(level)}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-3 h-3 rounded bg-teal-500" />
            Güvenli bölge
          </span>
        </div>
      </header>
      <div className="flex-1 p-4 min-h-0">
        <DisasterMap buildings={buildings} zones={zones} height="calc(100vh - 180px)" />
      </div>
    </div>
  );
}
