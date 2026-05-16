import { useMemo, useState } from 'react';
import { buildAmbulanceRoute } from '../utils/ambulanceRoute.js';
import { buildPhotoRiskRows, buildUserRiskRows } from '../utils/riskAggregation.js';
import { formatUserMessage } from '../utils/formatUserMessage.js';
import { findNearestHospital } from '../utils/distanceCalculator.js';

export default function AmbulanceRoutePlanner({
  buildings,
  photoReports,
  hospitals,
  hospitalsLoading = false,
  hospitalsError = null,
  onRouteReady,
  onHighlightIncident,
  onRequestMapPick,
  mapPickMode = null,
  customDestination = null,
  onClearCustomDestination,
}) {
  const [selectedId, setSelectedId] = useState('');
  const [useCustomDest, setUseCustomDest] = useState(false);
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

  const destination = useMemo(() => {
    if (useCustomDest && customDestination?.lat != null) {
      return {
        lat: customDestination.lat,
        lng: customDestination.lng,
        name: customDestination.name || 'Harita hedefi',
        kind: 'custom',
        id: 'custom-dest',
      };
    }
    if (!selected) return null;
    return {
      lat: selected.lat,
      lng: selected.lng,
      name: selected.name,
      kind: selected.kind,
      id: selected.id,
    };
  }, [useCustomDest, customDestination, selected]);

  const nearestHospital = useMemo(() => {
    if (!destination?.lat) return null;
    const h = findNearestHospital(destination.lat, destination.lng, hospitals);
    if (!h?.lat) return null;
    return { lat: h.lat, lng: h.lng, name: h.name };
  }, [destination, hospitals]);

  const runPlan = async () => {
    if (!destination) {
      setError('Hedef seçin: listeden olay veya haritadan nokta.');
      return;
    }
    if (!nearestHospital) {
      setError('Hedefe yakın hastane bulunamadı.');
      return;
    }
    setLoading(true);
    setError('');
    setLastResult(null);
    onHighlightIncident?.({ lat: destination.lat, lng: destination.lng, name: destination.name });

    try {
      const result = await buildAmbulanceRoute({
        destination,
        hospitals,
        photoReports,
        buildings,
        selectedIncident: selected || destination,
      });
      setLastResult(result);
      onRouteReady?.(result);
    } catch (e) {
      const msg = formatUserMessage(e?.message ?? e) || 'Güvenli ambulans rotası oluşturulamadı.';
      setError(msg);
      onRouteReady?.(null);
    } finally {
      setLoading(false);
    }
  };

  const route = lastResult?.primaryRoute;

  return (
    <section className="rounded-xl border border-rose-900/50 bg-slate-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 bg-rose-950/30">
        <h3 className="font-semibold text-white flex items-center gap-2 text-base">
          <span aria-hidden>🚑</span> Ambulans — 30 yol denemesi (ara sokak dahil)
        </h3>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-400 leading-relaxed">
          <strong className="text-emerald-300">30 farklı yol</strong> denenir: otoyol/trunk{' '}
          <strong className="text-slate-300">kullanılmaz</strong>; örnek cadde zinciri (Örgü Cad. → Özdemir
          Sok. → … → Yavuz Sultan Selim Cad.) ve mahalle ara noktaları OSRM’ye zorlanır. Güvenli olanlar arasında{' '}
          <strong className="text-sky-300">en çok sokak içeren</strong> rota seçilir.
          Yol üzerinde veya <strong className="text-rose-300">15 m</strong> içinde{' '}
          <strong>kullanıcı bildirimi</strong> varsa o rota elenir; kalan en kısa güvenli yol seçilir.
          Başlangıç: hedefe en yakın hastane (otomatik).
        </p>

        {hospitalsLoading && (
          <p className="text-sm text-amber-200/90 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
            Hastane listesi yükleniyor…
          </p>
        )}
        {hospitalsError && !hospitalsLoading && (
          <p className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
            {hospitalsError}
          </p>
        )}
        {!hospitals?.length && !hospitalsLoading && (
          <p className="text-sm text-red-300 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            Hastane verisi yok. <code className="text-xs">npm run fetch:hospitals</code>
          </p>
        )}
        {nearestHospital && (
          <p className="text-sm text-sky-200/90 bg-sky-950/30 border border-sky-900/40 rounded-lg px-3 py-2">
            Başlangıç: <strong>{nearestHospital.name}</strong> (en yakın hastane)
          </p>
        )}

        <label className="block text-sm text-slate-400">
          Hedef (olay yeri)
          <select
            value={useCustomDest ? '__map__' : selectedId}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__map__') {
                setUseCustomDest(true);
                setSelectedId('');
                onRequestMapPick?.('dest');
                return;
              }
              setUseCustomDest(false);
              onClearCustomDestination?.();
              setSelectedId(v);
              setError('');
              const inc = incidents.find((i) => i.id === v);
              if (inc) onHighlightIncident?.({ lat: inc.lat, lng: inc.lng, name: inc.name });
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-white"
          >
            <option value="">— Bildirim seçin —</option>
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.label} · risk {inc.riskScore}
              </option>
            ))}
            <option value="__map__">📍 Haritadan hedef seç…</option>
          </select>
          {useCustomDest && customDestination && (
            <p className="text-xs text-emerald-300 mt-1">
              Hedef: {customDestination.lat?.toFixed(5)}, {customDestination.lng?.toFixed(5)}
            </p>
          )}
        </label>

        <button
          type="button"
          onClick={runPlan}
          disabled={loading || hospitalsLoading || !destination || !hospitals?.length}
          className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold text-white text-base disabled:opacity-40"
        >
          {loading ? '30 yol deneniyor…' : '🚑 Güvenli rota oluştur'}
        </button>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {lastResult && route && (
          <div className="text-sm space-y-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-3">
            <p className="text-emerald-100 text-base">
              <strong>{lastResult.hospitalName}</strong> → <strong>{lastResult.destinationName}</strong>
            </p>
            <p className="text-emerald-300 font-medium">{route.summary}</p>
            {lastResult.geminiNotes && (
              <p className="text-xs text-slate-300">{lastResult.geminiNotes}</p>
            )}
            {lastResult.primaryRoute?.streetLabels && (
              <p className="text-xs text-violet-200/80 italic">{lastResult.primaryRoute.streetLabels}</p>
            )}
            {lastResult.routeCandidates?.length > 0 && (
              <ul className="text-xs text-slate-400 space-y-0.5 border-t border-slate-800 pt-2 max-h-40 overflow-y-auto">
                {lastResult.routeCandidates.slice(0, 15).map((c) => (
                  <li key={c.index}>
                    Yol {c.index}
                    {c.variant === 'sokak-zinciri'
                      ? ' · cadde zinciri'
                      : c.variant?.startsWith('sokak')
                        ? ' · sokak'
                        : c.variant?.startsWith('side') || c.variant?.startsWith('mahalle')
                          ? ' · mahalle'
                          : ''}
                    {c.sokakCount > 0 ? ` · ${c.sokakCount} sokak` : ''}:{' '}
                    {c.safe ? (
                      <span className="text-emerald-400">✓ güvenli</span>
                    ) : (
                      <span className="text-rose-400">
                        ✗ elendi
                        {c.conflict?.building?.name ? ` (${c.conflict.building.name})` : ''}
                      </span>
                    )}
                  </li>
                ))}
                {lastResult.routeCandidates.length > 15 && (
                  <li className="text-slate-500 italic">
                    + {lastResult.routeCandidates.length - 15} yol daha (özet üstte)
                  </li>
                )}
              </ul>
            )}
            <p className="text-lg font-bold text-amber-200">
              Önerilen ambulans: {lastResult.ambulanceCount} adet
            </p>
            <p className="text-xs text-slate-400">{lastResult.ambulanceDetail}</p>
          </div>
        )}
      </div>
    </section>
  );
}
