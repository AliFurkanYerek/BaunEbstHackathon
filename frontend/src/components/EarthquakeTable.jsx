import { useEarthquakes } from '../hooks/useEarthquakes.js';

function formatTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function magClass(mag) {
  if (mag >= 5) return 'text-red-400 font-bold';
  if (mag >= 4) return 'text-orange-400 font-semibold';
  if (mag >= 3) return 'text-amber-300';
  return 'text-slate-300';
}

export default function EarthquakeTable() {
  const { rows, loading, error } = useEarthquakes();

  return (
    <section className="rounded-xl border border-amber-900/40 bg-slate-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 bg-amber-950/20">
        <h3 className="font-semibold text-white text-lg">Son depremler (Türkiye bölgesi)</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Açık veri: USGS · AFAD/Kandilli ile karşılaştırma için referans
        </p>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        {loading && <p className="p-4 text-base text-slate-400">Yükleniyor…</p>}
        {error && <p className="p-4 text-base text-red-400">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="p-4 text-base text-slate-500">Kayıt bulunamadı.</p>
        )}
        {!loading && rows.length > 0 && (
          <table className="w-full text-base text-left">
            <thead className="sticky top-0 bg-slate-950 text-slate-400 text-sm uppercase">
              <tr>
                <th className="px-4 py-3">Tarih / saat</th>
                <th className="px-4 py-3">Büyüklük</th>
                <th className="px-4 py-3">Derinlik</th>
                <th className="px-4 py-3">Konum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                    {formatTime(r.time)}
                  </td>
                  <td className={`px-4 py-3 ${magClass(r.magnitude)}`}>
                    {r.magnitude?.toFixed(1) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.depthKm != null ? `${r.depthKm} km` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.place}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
