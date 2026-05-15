import { ALL_CITIES } from '../utils/safeZonesByCity.js';

/**
 * Şehir (il) seçici — güvenli bölgeleri kategorilemek için
 */
export default function CityZoneFilter({
  groups,
  selectedCity,
  onSelectCity,
  totalCount,
  className = '',
}) {
  if (!groups?.length) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Şehre göre
        </span>
        <span className="text-xs text-slate-500">{groups.length} il</span>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
        <button
          type="button"
          onClick={() => onSelectCity(ALL_CITIES)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            selectedCity === ALL_CITIES
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          Tümü ({totalCount.toLocaleString('tr-TR')})
        </button>
        {groups.map((g) => (
          <button
            key={g.city}
            type="button"
            onClick={() => onSelectCity(g.city)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              selectedCity === g.city
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
            title={`${g.count} alan · ${g.totalCapacity.toLocaleString('tr-TR')} kişi kapasite`}
          >
            {g.city} ({g.count})
          </button>
        ))}
      </div>
    </div>
  );
}
