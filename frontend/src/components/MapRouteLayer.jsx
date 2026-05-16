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

export default function MapRouteLayer({ route, fitBounds = false }) {
  if (!route?.positions?.length) return null;

  const isStraight = route.source === 'straight';
  const isAmbulance = route.routeKind === 'ambulance';
  const isHospital = route.routeKind === 'hospital';
  const routeColor =
    route.color ||
    (isAmbulance
      ? '#22c55e'
      : isHospital
        ? isStraight
          ? '#f87171'
          : '#dc2626'
        : isStraight
          ? '#f59e0b'
          : '#22d3ee');
  const weight = route.weight ?? (isAmbulance ? 6 : 5);
  const opacity = route.opacity ?? 0.9;
  const summary =
    route.distanceM != null && route.durationS != null
      ? formatRouteSummary(route.distanceM, route.durationS, isAmbulance ? 'driving' : 'foot')
      : null;
  const showEndpoints = route.showEndpoints !== false && (route.tier === 'short' || !route.tier);

  return (
    <>
      {fitBounds && <FitRouteBounds positions={route.positions} />}
      <Polyline
        positions={route.positions}
        pathOptions={{
          color: routeColor,
          weight,
          opacity,
          dashArray: isStraight ? '12, 10' : route.tier === 'long' ? '8, 6' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {showEndpoints && route.from && isAmbulance && (
        <Marker position={[route.from.lat, route.from.lng]} icon={routeOriginIconAmbulance}>
          <Popup>
            <div className="text-slate-800 text-sm min-w-[160px]">
              <p className="font-bold">🚑 {route.originName || 'Hastane'}</p>
            </div>
          </Popup>
        </Marker>
      )}
      {showEndpoints && route.to && isAmbulance && (
        <Marker position={[route.to.lat, route.to.lng]} icon={routeDestIconIncident}>
          <Popup>
            <div className="text-slate-800 text-sm min-w-[160px]">
              <p className="font-bold">📍 {route.destinationName || 'Olay yeri'}</p>
              <p className="text-xs mt-1 text-slate-600">Varış — olay kırmızısına girilebilir</p>
              {summary && <p className="text-xs mt-1 text-slate-600">{summary}</p>}
            </div>
          </Popup>
        </Marker>
      )}
      {showEndpoints && route.to && !isAmbulance && (
        <Marker
          position={[route.to.lat, route.to.lng]}
          icon={
            route.routeKind === 'hospital' ? routeDestIconHospital : routeDestIconSafe
          }
        >
          <Popup>
            <div className="text-slate-800 text-sm min-w-[160px]">
              {route.label && <p className="text-xs font-semibold text-slate-500">{route.label}</p>}
              <p className="font-bold">
                {route.routeKind === 'hospital' ? '🏥' : '🛡️'}{' '}
                {route.destinationName || 'Hedef'}
              </p>
              {summary && <p className="text-xs mt-1 text-slate-600">{summary}</p>}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}
