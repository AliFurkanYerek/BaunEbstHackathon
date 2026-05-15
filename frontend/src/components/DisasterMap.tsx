import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { Building, SafeZone, SosReport } from '../types';
import { damageColor, damageLabel } from '../utils/damage';

interface EvacuationLine {
  from: [number, number];
  to: [number, number];
  buildingName: string;
  zoneName: string;
}

interface Props {
  buildings: Building[];
  zones: SafeZone[];
  sosReports?: SosReport[];
  evacuationLines?: EvacuationLine[];
  center?: [number, number];
  zoom?: number;
  onMapClick?: (lat: number, lng: number) => void;
  height?: string;
}

function makeIcon(color: string, size = 14) {
  return L.divIcon({
    className: '',
    html: `<div class="damage-marker" style="width:${size}px;height:${size}px;background:${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const zoneIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#14b8a6;border:2px solid white;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const sosIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 0 12px #ef4444"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function DisasterMap({
  buildings,
  zones,
  sosReports = [],
  evacuationLines = [],
  center = [39.5004, 26.9762],
  zoom = 14,
  onMapClick,
  height = '100%',
}: Props) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const mapKey = useMemo(
    () => `${buildings.length}-${zones.length}-${sosReports.length}`,
    [buildings.length, zones.length, sosReports.length]
  );

  return (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={zoom}
      style={{ height, width: '100%' }}
      className="rounded-xl overflow-hidden border border-slate-800"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onMapClick && <MapClickHandler onClick={onMapClick} />}
      {zones.map((z) => (
        <Marker key={z.id} position={[z.lat, z.lng]} icon={zoneIcon}>
          <Popup>
            <strong className="text-teal-700">🛡️ {z.name}</strong>
            <br />
            Kapasite: {z.capacity} kişi
            <br />
            Su: {z.supplies_water}L · Gıda: {z.supplies_food}
          </Popup>
          <Circle
            center={[z.lat, z.lng]}
            radius={80}
            pathOptions={{ color: '#14b8a6', fillColor: '#14b8a6', fillOpacity: 0.08, weight: 1 }}
          />
        </Marker>
      ))}
      {buildings.map((b) => (
        <Marker
          key={b.id}
          position={[b.lat, b.lng]}
          icon={makeIcon(damageColor(b.damage_level), b.damage_level === 'collapsed' ? 18 : 14)}
        >
          <Popup>
            <strong>{b.name}</strong>
            <br />
            {b.address}
            <br />
            <span style={{ color: damageColor(b.damage_level) }}>
              {damageLabel(b.damage_level)}
            </span>
            <br />
            ~{b.estimated_occupants} kişi · {b.floors} kat
          </Popup>
        </Marker>
      ))}
      {sosReports.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={sosIcon}>
          <Popup>
            <strong className="text-red-600">SOS — Öncelik {s.priority_score.toFixed(0)}</strong>
            <br />
            {s.command_type}
          </Popup>
        </Marker>
      ))}
      {evacuationLines.map((line, i) => (
        <Polyline
          key={i}
          positions={[line.from, line.to]}
          pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '6 8', opacity: 0.7 }}
        />
      ))}
    </MapContainer>
  );
}
