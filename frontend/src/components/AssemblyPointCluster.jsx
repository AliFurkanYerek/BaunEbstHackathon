import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const clusterIcon = L.divIcon({
  html: `<div style="background:#6366f1;width:12px;height:12px;border-radius:50%;border:2px solid white"></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function createClusterGroup() {
  return L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 120,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      const size = count > 500 ? 44 : count > 100 ? 38 : count > 20 ? 32 : 28;
      return L.divIcon({
        html: `<div style="background:#4f46e5;color:white;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${count}</div>`,
        className: 'assembly-cluster',
        iconSize: [size, size],
      });
    },
  });
}

export default function AssemblyPointCluster({ points, visible = true }) {
  const map = useMap();

  useEffect(() => {
    if (!visible || !points?.length) return;

    const cluster = createClusterGroup();

    for (const p of points) {
      const marker = L.marker([p.lat, p.lng], { icon: clusterIcon });
      marker.bindPopup(`
        <div style="min-width:180px;font-size:13px">
          <strong style="color:#4f46e5">🛡️ ${p.name}</strong><br/>
          <span style="color:#64748b">${p.il || ''} / ${p.ilce || ''}</span><br/>
          ${p.mahalle ? `<small>${p.mahalle}</small><br/>` : ''}
          ${p.address ? `<small>${p.address}</small><br/>` : ''}
          <small style="color:#94a3b8">AFAD resmi toplanma alanı</small>
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
