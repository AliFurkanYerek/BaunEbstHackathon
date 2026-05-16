import { useEffect } from 'react';
import { Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatRouteSummary } from '../utils/osrmRoute.js';

const routeDestIconSafe = L.divIcon({
  className: '',
  html: '<div style="width:26px;height:26px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(34,197,94,0.55);font-size:14px;line-height:26px;text-align:center">🛡️</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const routeDestIconHospital = L.divIcon({
  className: '',
  html: '<div style="width:26px;height:26px;background:#dc2626;border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(220,38,38,0.55);font-size:14px;line-height:26px;text-align:center">🏥</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function FitRouteBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length || positions.length < 2) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [56, 56], maxZoom: 16 });
  }, [positions, map]);
  return null;
}

/**
 * @param {{ positions: [number,number][]; distanceM?: number; durationS?: number; source?: string; destinationName?: string; to?: { lat: number; lng: number } }} route
 */
export default function MapRouteLayer({ route }) {
  if (!route?.positions?.length) return null;

  const isStraight = route.source === 'straight';
  const isHospital = route.routeKind === 'hospital';
  const routeColor = isHospital
    ? isStraight
      ? '#f87171'
      : '#dc2626'
    : isStraight
      ? '#f59e0b'
      : '#22d3ee';
  const summary =
    route.distanceM != null && route.durationS != null
      ? formatRouteSummary(route.distanceM, route.durationS)
      : null;

  return (
    <>
      <FitRouteBounds positions={route.positions} />
      <Polyline
        positions={route.positions}
        pathOptions={{
          color: routeColor,
          weight: 6,
          opacity: 0.9,
          dashArray: isStraight ? '12, 10' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {route.to && (
        <Marker
          position={[route.to.lat, route.to.lng]}
          icon={route.routeKind === 'hospital' ? routeDestIconHospital : routeDestIconSafe}
        >
          <Popup>
            <div className="text-slate-800 text-sm min-w-[160px]">
              <p className="font-bold">
                {route.routeKind === 'hospital' ? '🏥' : '🛡️'}{' '}
                {route.destinationName ||
                  (route.routeKind === 'hospital' ? 'Hastane' : 'Güvenli bölge')}
              </p>
              {summary && <p className="text-xs mt-1 text-slate-600">{summary}</p>}
              {isStraight && (
                <p className="text-xs mt-1 text-amber-700">
                  Sokak rotası alınamadı; düz çizgi gösteriliyor.
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}
