import { useState, useEffect, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getEmergencyLabels, normalizeEmergencyTypes } from '../data/sampleData.js';
import {
  calculatePhotoRiskScore,
  PHOTO_LOCATION_RADIUS_M,
} from '../utils/riskAggregation.js';
import AssemblyPointCluster from './AssemblyPointCluster.jsx';
import HospitalCluster from './HospitalCluster.jsx';
import MapRouteLayer from './MapRouteLayer.jsx';
import {
  MAP_LAYER_ALL,
  showsHospitals,
  showsReports,
  showsSafeZones,
} from '../utils/mapLayerFilter.js';
import { isIncidentHazard } from '../utils/hazardZones.js';
import { zoneType, zoneRing } from '../utils/riskGeometry.js';

const DAMAGE_COLORS = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#eab308',
  4: '#f97316',
  5: '#dc2626',
};

function damageIcon(level, highRisk = false) {
  const color = DAMAGE_COLORS[level] ?? '#94a3b8';
  const size = 12 + level * 2;
  const pulse = highRisk ? 'marker-pulse' : '';
  return L.divIcon({
    className: '',
    html: `<div class="marker-damage ${pulse}" style="width:${size}px;height:${size}px;background:${color};border-radius:50%"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const safeIcon = L.divIcon({
  className: '',
  html: `<div class="marker-safe" style="width:20px;height:20px;background:#6366f1;border-radius:4px"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const selectedIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#0ea5e9;border:3px solid white;border-radius:50%;box-shadow:0 0 20px #0ea5e9"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const photoReportIcon = L.divIcon({
  className: '',
  html:
    '<div style="width:30px;height:30px;background:#c2410c;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 12px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">E</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function MapClickHandler({ onMapClick, enabled }) {
  useMapEvents({
    click(e) {
      if (enabled && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

/** Yeni analiz veya odaklanılan konuma haritayı kaydırır */
function FlyToHighlight({ lat, lng, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.flyTo([lat, lng], zoom ?? 14, { duration: 0.85 });
  }, [lat, lng, zoom, map]);
  return null;
}

function PhotoReportPopupContent({ report }) {
  const risk = calculatePhotoRiskScore(report);
  return (
    <div className="text-slate-800 text-sm min-w-[200px]">
      <p className="font-bold">Enkaz / hasar fotoğrafı</p>
      <p className="text-xs text-slate-600">{report.fileName}</p>
      {report.address && <p className="text-xs mt-1">{report.address}</p>}
      <p className="text-xs mt-1">
        Yıkık tespit: <strong>{report.collapsed ?? 0}</strong> · Hasar önerisi:{' '}
        {report.suggestedDamageLevel ?? '—'}/5
      </p>
      <p className="text-xs">Risk puanı: {risk}</p>
      <p className="text-[10px] text-slate-500 mt-1">
        {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
      </p>
    </div>
  );
}

function BuildingPopupContent({ building }) {
  const zone = building.nearestSafeZone;
  const aid = building.aidNeeds;

  return (
    <div className="text-slate-800 text-sm min-w-[200px]">
      <p className="font-bold">{building.name}</p>
      <p className="text-xs text-slate-500">{building.street}</p>
      <p className="text-xs mt-1">Kişi: {building.peopleCount} · Hasar: {building.damageLevel}/5</p>
      <ul className="text-xs mt-1 space-y-0.5">
        {getEmergencyLabels(normalizeEmergencyTypes(building)).map((l) => (
          <li key={l}>🚨 {l}</li>
        ))}
      </ul>
      <p className="text-xs">Risk: {building.riskScore}</p>
      {zone && <p className="text-xs">🛡️ {zone.name} ({zone.distanceKm} km)</p>}
      {aid && (
        <p className="text-xs mt-1">
          💧{aid.water}L 🍞{aid.food} 🛏️{aid.blankets}
        </p>
      )}
    </div>
  );
}

export default function MapView({
  buildings = [],
  safeZones = [],
  assemblyPoints = [],
  center,
  zoom = 14,
  onMapClick,
  mapClickEnabled = false,
  selectedPosition = null,
  showRiskHeat = false,
  highlightPhotoLocation = null,
  highlightSafeZone = null,
  photoReports = [],
  hospitals = [],
  mapLayer = MAP_LAYER_ALL,
  navigationRoute = null,
  navigationRoutes = null,
  routeHazards = null,
  incidentTarget = null,
  scrollWheelZoom = true,
  offlineMode = false,
}) {
  const showSafe = showsSafeZones(mapLayer);
  const showHospitalLayer = showsHospitals(mapLayer);
  const showReportLayer = showsReports(mapLayer);

  const visibleAssembly = showSafe ? assemblyPoints : [];
  const visibleHospitals = showHospitalLayer ? hospitals : [];
  const visibleBuildings = showReportLayer ? buildings : [];
  const visiblePhotoReports = showReportLayer ? photoReports : [];

  const useAfadCluster = visibleAssembly.length > 0;
  const showHospitalCluster = visibleHospitals.length > 0;
  const [mounted, setMounted] = useState(false);

  const savedPhotoMarkers = visiblePhotoReports.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
        Harita yükleniyor...
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%', minHeight: 300 }}
      scrollWheelZoom={scrollWheelZoom}
    >
      <TileLayer
        attribution={offlineMode ? '© OSM (önbellek)' : '© OpenStreetMap'}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapResizer />
      <MapClickHandler onMapClick={onMapClick} enabled={mapClickEnabled} />

      {routeHazards?.map((h, i) => {
        const isOlay = incidentTarget && isIncidentHazard(h, incidentTarget);
        const zone = h.polygon?.length >= 3 ? { ...h, type: 'polygon', coordinates: h.polygon } : h;
        if (zoneType(zone) === 'polygon') {
          return (
            <Polygon
              key={h.buildingId || h.reportId || h.id || `hazard-poly-${i}`}
              positions={zoneRing(zone)}
              pathOptions={{
                color: isOlay ? '#22c55e' : '#dc2626',
                fillColor: isOlay ? '#22c55e' : '#dc2626',
                fillOpacity: isOlay ? 0.12 : 0.18,
                weight: isOlay ? 3 : 2,
                dashArray: isOlay ? '6,4' : undefined,
              }}
            />
          );
        }
        return (
          <Circle
            key={h.buildingId || h.reportId || h.id || `hazard-${i}`}
            center={[h.lat, h.lng]}
            radius={h.radiusM ?? 70}
            pathOptions={{
              color: isOlay ? '#22c55e' : h.kind === 'user' ? '#f43f5e' : '#dc2626',
              fillColor: isOlay ? '#22c55e' : h.kind === 'user' ? '#f43f5e' : '#dc2626',
              fillOpacity: isOlay ? 0.12 : 0.18,
              weight: isOlay ? 3 : 2,
              dashArray: isOlay ? '6,4' : h.kind === 'user' ? '8,5' : undefined,
            }}
          />
        );
      })}

      {(() => {
        const list =
          navigationRoutes?.length > 0
            ? navigationRoutes
            : navigationRoute?.positions?.length
              ? [navigationRoute]
              : [];
        return list.map((r, i) => (
          <MapRouteLayer key={r.id || `route-${i}`} route={r} fitBounds={i === 0} />
        ));
      })()}

      {showHospitalCluster && <HospitalCluster points={visibleHospitals} />}

      {useAfadCluster ? (
        <AssemblyPointCluster points={visibleAssembly} />
      ) : (
        showSafe &&
        safeZones.map((zone) => (
          <Fragment key={zone.id}>
            <Marker position={[zone.lat, zone.lng]} icon={safeIcon}>
              <Popup>
                <strong>🛡️ {zone.name}</strong>
                <br />
                Kapasite: {zone.capacity}
              </Popup>
            </Marker>
          </Fragment>
        ))
      )}

      {selectedPosition && (
        <Marker position={[selectedPosition.lat, selectedPosition.lng]} icon={selectedIcon}>
          <Popup>
            <strong>📍 Seçilen konum</strong>
            <br />
            {selectedPosition.lat.toFixed(5)}, {selectedPosition.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}

      {highlightSafeZone &&
        Number.isFinite(highlightSafeZone.lat) &&
        Number.isFinite(highlightSafeZone.lng) && (
          <>
            <FlyToHighlight
              lat={highlightSafeZone.lat}
              lng={highlightSafeZone.lng}
              zoom={16}
            />
            <Marker position={[highlightSafeZone.lat, highlightSafeZone.lng]} icon={safeIcon}>
              <Popup>
                <strong>🛡️ {highlightSafeZone.name}</strong>
                <br />
                {highlightSafeZone.il && <span>{highlightSafeZone.il}</span>}
                {highlightSafeZone.ilce && <span> · {highlightSafeZone.ilce}</span>}
                <br />
                Kapasite: {highlightSafeZone.capacity ?? '—'} kişi
                {highlightSafeZone.address && (
                  <>
                    <br />
                    <span className="text-xs">{highlightSafeZone.address}</span>
                  </>
                )}
              </Popup>
            </Marker>
            <Circle
              center={[highlightSafeZone.lat, highlightSafeZone.lng]}
              radius={120}
              pathOptions={{
                color: '#a855f7',
                fillColor: '#a855f7',
                fillOpacity: 0.15,
                weight: 2,
              }}
            />
          </>
        )}

      {showReportLayer &&
        highlightPhotoLocation &&
        Number.isFinite(highlightPhotoLocation.lat) &&
        Number.isFinite(highlightPhotoLocation.lng) && (
          <FlyToHighlight
            lat={highlightPhotoLocation.lat}
            lng={highlightPhotoLocation.lng}
            zoom={14}
          />
        )}

      {savedPhotoMarkers.map((p) => (
        <Fragment key={p.id}>
          <Marker position={[p.lat, p.lng]} icon={photoReportIcon}>
            <Popup>
              <PhotoReportPopupContent report={p} />
            </Popup>
          </Marker>
          <Circle
            center={[p.lat, p.lng]}
            radius={PHOTO_LOCATION_RADIUS_M}
            pathOptions={{
              color: '#ea580c',
              fillColor: '#ea580c',
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
        </Fragment>
      ))}

      {visibleBuildings.map((b) => (
        <Fragment key={b.id}>
          <Marker
            position={[b.lat, b.lng]}
            icon={damageIcon(b.damageLevel, showRiskHeat && b.riskScore >= 150)}
          >
            <Popup>
              <BuildingPopupContent building={b} />
            </Popup>
          </Marker>
          {showRiskHeat &&
            b.riskScore >= 200 &&
            !routeHazards?.some((h) => h.buildingId === b.id) && (
            <Circle
              center={[b.lat, b.lng]}
              radius={60 + b.riskScore / 5}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.15,
                weight: 1,
              }}
            />
          )}
        </Fragment>
      ))}
    </MapContainer>
  );
}
