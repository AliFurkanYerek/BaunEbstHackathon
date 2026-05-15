import { useState, useEffect, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getEmergencyLabels, normalizeEmergencyTypes } from '../data/sampleData.js';
import AssemblyPointCluster from './AssemblyPointCluster.jsx';

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
}) {
  const useAfadCluster = assemblyPoints.length > 0;
  const [mounted, setMounted] = useState(false);

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
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapResizer />
      <MapClickHandler onMapClick={onMapClick} enabled={mapClickEnabled} />

      {useAfadCluster ? (
        <AssemblyPointCluster points={assemblyPoints} />
      ) : (
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

      {buildings.map((b) => (
        <Fragment key={b.id}>
          <Marker
            position={[b.lat, b.lng]}
            icon={damageIcon(b.damageLevel, showRiskHeat && b.riskScore >= 150)}
          >
            <Popup>
              <BuildingPopupContent building={b} />
            </Popup>
          </Marker>
          {showRiskHeat && b.riskScore >= 200 && (
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
