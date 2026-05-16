import { useMemo, useState } from 'react';
import { buildAmbulanceRoute } from '../utils/ambulanceRoute.js';
import { buildPhotoRiskRows, buildUserRiskRows } from '../utils/riskAggregation.js';
import { COLLAPSED_AVOID_RADIUS_M } from '../utils/hazardZones.js';
import { formatUserMessage } from '../utils/formatUserMessage.js';
import { getGeminiApiKey } from '../utils/gemini.js';

export default function AmbulanceRoutePlanner({
  buildings,
  photoReports,
  hospitals,
  onRouteReady,
  onHighlightIncident,
}) {
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const incidents = useMemo(() => {
    const photos = buildPhotoRiskRows(photoReports).map((r) => ({
      ...r,
      kind: 'photo',
      label: `📷 ${r.name}`,
    }));
    const users = buildUserRiskRows(buildings).map((r) => ({
      ...r,
      kind: 'user',
      label: `📍 ${r.name}`,
    }));
    return [...photos, ...users];
  }, [photoReports, buildings]);

  const selected = incidents.find((i) => i.id === selectedId) || null;

  const runPlan = async () => {
    if (!selected) {
      setError('Önce bildirilen bir konum seçin.');
      return;
    }
    setLoading(true);
    setError('');
    setLastResult(null);
    onHighlightIncident?.({ lat: selected.lat, lng: selected.lng, name: selected.name });

    try {
      const route = await buildAmbulanceRoute({
        destination: {
          lat: selected.lat,
          lng: selected.lng,
          name: selected.name,
          kind: selected.kind,
        },
        hospitals,
        photoReports,
        useGemini: true,
      });
      setLastResult(route);
      onRouteReady?.(route);
    } catch (e) {
      const msg = formatUserMessage(e?.message ?? e) || 'Ambulans rotası oluşturulamadı.';
      setError(msg);
      onRouteReady?.(null);
    } finally {
      setLoading(false);
    }
  };

  const hasGemini = Boolean(getGeminiApiKey());

  return (
    <section className="rounded-xl border border-rose-900/50 bg-slate-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 bg-rose-950/30">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span aria-hidden>🚑</span> Ambulans rotası (Gemini + yıkık bina kaçınma)
        </h3>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-xs text-slate-400">
          En yakın hastaneden seçilen bildirime araç rotası çizilir. Roboflow ile tespit edilen yıkık
          binaların <strong className="text-rose-300">{COLLAPSED_AVOID_RADIUS_M} m</strong> yakınından
          geçilmez.
          {!hasGemini && (
            <span className="block mt-1 text-amber-300">
              Gemini anahtarı yok — yalnızca otomatik kaçınma kullanılır.
            </span>
          )}
        </p>

        <label className="block text-xs text-slate-400">
          Bildirilen konum
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setError('');
              const inc = incidents.find((i) => i.id === e.target.value);
              if (inc) onHighlightIncident?.({ lat: inc.lat, lng: inc.lng, name: inc.name });
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value="">— Seçin —</option>
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.label} · risk {inc.riskScore}
                {inc.kind === 'photo' && inc.collapsed != null ? ` · yıkık ${inc.collapsed}` : ''}
              </option>
            ))}
          </select>
        </label>

        {incidents.length === 0 && (
          <p className="text-xs text-slate-500">Henüz haritada bildirim veya enkaz kaydı yok.</p>
        )}

        <button
          type="button"
          onClick={runPlan}
          disabled={loading || !selected || !hospitals?.length}
          className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Gemini + rota hesaplanıyor…' : 'Ambulans rotası oluştur'}
        </button>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {lastResult && (
          <div className="text-sm space-y-2 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-3">
            <p className="text-rose-100">
              <strong>{lastResult.hospitalName}</strong>
              {lastResult.hospitalDistanceKm != null && (
                <span className="text-slate-400"> · ≈ {lastResult.hospitalDistanceKm} km</span>
              )}
              {' → '}
              <strong>{lastResult.destinationName}</strong>
            </p>
            <p className="text-slate-300 text-xs">{lastResult.summary}</p>
            <p className="text-xs text-slate-400">
              Yıkık bina tespiti: {lastResult.hazardCount} · Ara nokta: {lastResult.waypointCount}
              {lastResult.avoidsCollapsed ? (
                <span className="text-emerald-400"> · {COLLAPSED_AVOID_RADIUS_M} m tampon sağlandı</span>
              ) : (
                <span className="text-amber-400">
                  {' '}
                  · Tampon tam uygulanamadı (yine de en iyi güzergâh çizildi)
                </span>
              )}
            </p>
            {lastResult.geminiNotes && (
              <p className="text-xs text-violet-200/90 border-t border-slate-800 pt-2">
                {lastResult.geminiNotes}
              </p>
            )}
            {lastResult.isEstimate && (
              <p className="text-xs text-amber-300">Sokak rotası alınamadı; düz çizgi gösteriliyor.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
