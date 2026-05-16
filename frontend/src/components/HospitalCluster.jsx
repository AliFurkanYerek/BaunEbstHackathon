import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';

const hospitalIcon = L.divIcon({
  html: `<div style="background:#dc2626;width:14px;height:14px;border-radius:3px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;line-height:1">+</div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function createClusterGroup() {
  return L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 120,
    maxClusterRadius: 48,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      const size = count > 500 ? 44 : count > 100 ? 38 : count > 20 ? 32 : 28;
      return L.divIcon({
        html: `<div style="background:#b91c1c;color:white;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${count}</div>`,
        className: 'hospital-cluster',
        iconSize: [size, size],
      });
    },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function HospitalCluster({ points, visible = true }) {
  const map = useMap();

  useEffect(() => {
    if (!visible || !points?.length) return;

    const cluster = createClusterGroup();

    for (const p of points) {
      const marker = L.marker([p.lat, p.lng], { icon: hospitalIcon });
      marker.bindPopup(`
        <div style="min-width:180px;font-size:13px">
          <strong style="color:#b91c1c">🏥 ${escapeHtml(p.name)}</strong><br/>
          ${p.il || p.ilce ? `<span style="color:#64748b">${escapeHtml(p.il || '')}${p.il && p.ilce ? ' / ' : ''}${escapeHtml(p.ilce || '')}</span><br/>` : ''}
          ${p.address ? `<small>${escapeHtml(p.address)}</small><br/>` : ''}
          ${p.emergency ? '<small style="color:#dc2626">Acil servis</small><br/>' : ''}
          <small style="color:#94a3b8">OpenStreetMap hastane verisi</small>
        </div>
      `);
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [map, points, visible]);

  return null;
}
