import { useMemo, useState } from 'react';
import { ALL_CITIES } from '../utils/safeZonesByCity.js';
import SafeZoneCheckIn from './SafeZoneCheckIn.jsx';
import SafeZonesByCityList from './SafeZonesByCityList.jsx';
import AssemblyZonePreviewMap from './AssemblyZonePreviewMap.jsx';

/**
 * Alt bölüm: toplanma alanı seçimi + önizleme haritası.
 * Üst operasyon haritasından bağımsız state kullanır.
 */
export default function BottomAssemblyPanel({ safeZones, zonesByCity, onArrival }) {
  const [listCity, setListCity] = useState(ALL_CITIES);
  const [selectedZoneId, setSelectedZoneId] = useState(null);

  const selectedZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return safeZones.find((z) => z.id === selectedZoneId) || null;
  }, [selectedZoneId, safeZones]);

  return (
    <div className="space-y-6 pt-2 border-t border-slate-800">
      <SafeZoneCheckIn
        zonesByCity={zonesByCity}
        onArrival={onArrival}
        selectedZoneId={selectedZoneId || ''}
        onZoneSelect={setSelectedZoneId}
      />

      <SafeZonesByCityList
        safeZones={safeZones}
        zonesByCity={zonesByCity}
        selectedCity={listCity}
        onSelectCity={setListCity}
        selectedZoneId={selectedZoneId}
        onSelectZone={setSelectedZoneId}
      />

      <AssemblyZonePreviewMap zone={selectedZone} />
    </div>
  );
}
