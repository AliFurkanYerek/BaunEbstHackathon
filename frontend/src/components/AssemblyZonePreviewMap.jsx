import MapView from './MapView.jsx';
import { MAP_LAYER_SAFE } from '../utils/mapLayerFilter.js';

export default function AssemblyZonePreviewMap({ zone }) {
  return (
    <section className="p-4 rounded-xl bg-slate-900/80 border border-indigo-800/50 space-y-3">
      <div>
        <h3 className="font-semibold text-white text-sm">Toplanma alanı haritası</h3>
        {zone ? (
          <>
            <p className="text-sm text-indigo-200 mt-1 font-medium">{zone.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {[zone.il, zone.ilce].filter(Boolean).join(' · ')}
              {zone.capacity ? ` · ${zone.capacity} kişi kapasite` : ''}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-500 mt-1">
            Yukarıdan bir toplanma alanı seçin; konum burada gösterilir.
          </p>
        )}
      </div>
      <div
        className="w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-800/50"
        style={{ height: 320 }}
      >
        {zone?.lat != null && zone?.lng != null ? (
          <MapView
            key={`bottom-assembly-${zone.id}`}
            center={[zone.lat, zone.lng]}
            zoom={16}
            assemblyPoints={[]}
            mapLayer={MAP_LAYER_SAFE}
            highlightSafeZone={zone}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm px-4 text-center">
            Henüz alan seçilmedi
          </div>
        )}
      </div>
    </section>
  );
}
