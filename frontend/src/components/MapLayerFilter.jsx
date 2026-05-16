/**
 * Harita katmanı: tümü / güvenli bölge / hastane (+ yetkili: bildirilenler)
 */
export default function MapLayerFilter({
  options,
  selectedLayer,
  onSelectLayer,
  className = '',
}) {
  if (!options?.length) return null;

  const activeClass = (id) => {
    if (selectedLayer !== id) {
      return 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600';
    }
    if (id === 'reports') return 'bg-orange-600 border-orange-500 text-white';
    if (id === 'hospital') return 'bg-red-700 border-red-600 text-white';
    if (id === 'safe') return 'bg-indigo-600 border-indigo-500 text-white';
    return 'bg-emerald-600 border-emerald-500 text-white';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        Harita katmanı
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelectLayer(opt.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${activeClass(opt.id)}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
