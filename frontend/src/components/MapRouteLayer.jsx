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

const routeOriginIconAmbulance = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;background:#e11d48;border:3px solid white;border-radius:8px;box-shadow:0 2px 12px rgba(225,29,72,0.55);font-size:15px;line-height:28px;text-align:center">🚑</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const routeDestIconIncident = L.divIcon({
  className: '',
  html: '<div style="width:26px;height:26px;background:#f97316;border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(249,115,22,0.55);font-size:14px;line-height:26px;text-align:center">📍</div>',
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
  const isAmbulance = route.routeKind === 'ambulance';
  const isHospital = route.routeKind === 'hospital';
  const routeColor = isAmbulance
    ? isStraight
      ? '#fb7185'
      : '#f43f5e'
    : isHospital
      ? isStraight
        ? '#f87171'
        : '#dc2626'
      : isStraight
        ? '#f59e0b'
        : '#22d3ee';
  const summary =
    route.distanceM != null && route.durationS != null
      ? formatRouteSummary(
          route.distanceM,
          route.durationS,
          isAmbulance ? 'driving' : 'foot'
        )
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
      {route.from && isAmbulance && (
        <Marker position={[route.from.lat, route.from.lng]} icon={routeOriginIconAmbulance}>
          <Popup>
            <div className="text-slate-800 text-sm min-w-[160px]">
              <p className="font-bold">🚑 {route.originName || 'Hastane (kalkış)'}</p>
              {summary && <p className="text-xs mt-1 text-slate-600">{summary}</p>}
            </div>
          </Popup>
        </Marker>
      )}
      {route.to && (
        <Marker
          position={[route.to.lat, route.to.lng]}
          icon={
            isAmbulance
              ? routeDestIconIncident
              : route.routeKind === 'hospital'
                ? routeDestIconHospital
                : routeDestIconSafe
          }
        >
          <Popup>
            <div className="text-slate-800 text-sm min-w-[160px]">
              <p className="font-bold">
                {isAmbulance ? '📍' : route.routeKind === 'hospital' ? '🏥' : '🛡️'}{' '}
                {route.destinationName ||
                  (isAmbulance
                    ? 'Bildirilen konum'
                    : route.routeKind === 'hospital'
                      ? 'Hastane'
                      : 'Güvenli bölge')}
              </p>
              {summary && !route.from && <p className="text-xs mt-1 text-slate-600">{summary}</p>}
              {isAmbulance && route.geminiNotes && (
                <p className="text-xs mt-1 text-slate-600">{route.geminiNotes}</p>
              )}
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
