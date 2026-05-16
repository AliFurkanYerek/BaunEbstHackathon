import { useMemo } from 'react';
import { ALL_CITIES, filterZonesByCity } from '../utils/safeZonesByCity.js';
import CityZoneFilter from './CityZoneFilter.jsx';

const LIST_LIMIT = 80;

export default function SafeZonesByCityList({
  safeZones,
  zonesByCity,
  selectedCity,
  onSelectCity,
  selectedZoneId = null,
  onSelectZone,
}) {
  const filtered = useMemo(
    () => filterZonesByCity(safeZones, selectedCity),
    [safeZones, selectedCity]
  );

  const visible = filtered.slice(0, LIST_LIMIT);
  const selectedGroup =
    selectedCity !== ALL_CITIES
      ? zonesByCity.find((g) => g.city === selectedCity)
      : null;

  return (
    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
      <h4 className="text-sm font-semibold text-slate-300">Güvenli Bölgeler (şehre göre)</h4>

      <CityZoneFilter
        groups={zonesByCity}
        selectedCity={selectedCity}
        onSelectCity={onSelectCity}
        totalCount={safeZones.length}
      />

      {selectedGroup && (
        <p className="text-xs text-indigo-300/90">
          {selectedGroup.city}: {selectedGroup.count} alan · toplam{' '}
          {selectedGroup.totalCapacity.toLocaleString('tr-TR')} kişi kapasite
        </p>
      )}

      <ul className="space-y-1.5 text-sm text-slate-400 max-h-48 overflow-y-auto">
        {visible.map((z) => (
          <li key={z.id}>
            <button
              type="button"
              onClick={() => onSelectZone?.(z.id)}
              className={`w-full flex justify-between gap-2 border-b border-slate-800/60 pb-1.5 text-left transition-colors rounded px-1 -mx-1 ${
                selectedZoneId === z.id
                  ? 'bg-indigo-950/60 ring-1 ring-indigo-500/50'
                  : 'hover:bg-slate-800/50'
              }`}
            >
            <span className="min-w-0 truncate">
              🛡️ {z.name}
              {selectedCity === ALL_CITIES && z.il && (
                <span className="text-slate-600 ml-1">· {z.il}</span>
              )}
            </span>
            <span className="text-slate-500 shrink-0">{z.capacity} kişi</span>
            </button>
          </li>
        ))}
      </ul>

      {filtered.length > LIST_LIMIT && (
        <p className="text-xs text-slate-500">
          +{filtered.length - LIST_LIMIT} alan daha (haritada mor noktalar)
        </p>
      )}
      {filtered.length === 0 && (
        <p className="text-xs text-slate-500">Bu il için kayıtlı alan yok.</p>
      )}
    </div>
  );
}
