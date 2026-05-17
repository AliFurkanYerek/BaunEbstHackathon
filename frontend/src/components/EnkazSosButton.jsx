import { useState } from 'react';
import { getDevicePosition } from '../utils/geolocation.js';
import { appendBuildingReport } from '../utils/buildingStorage.js';
import { formatUserMessage } from '../utils/formatUserMessage.js';

let sosId = Date.now();

export default function EnkazSosButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sendEnkazSos = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { lat, lng, accuracyM } = await getDevicePosition();
      const building = appendBuildingReport({
        id: `enkaz-sos-${++sosId}`,
        name: 'Enkaz altındayım',
        street: 'Ana sayfa (cihaz konumu)',
        peopleCount: 1,
        damageLevel: 5,
        emergencyTypes: ['enkaz'],
        lat,
        lng,
        isEnkazSos: true,
        reportSource: 'home_enkaz',
        createdAt: new Date().toISOString(),
        locationAccuracyM: accuracyM,
        note: 'Tek tuşla ana sayfa bildirimi',
      });

      setMessage(
        `Konum gönderildi (${lat.toFixed(5)}, ${lng.toFixed(5)}). Yetkililere iletildi.`
      );
      return building;
    } catch (err) {
      setError(formatUserMessage(err?.message ?? err) || 'Konum gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mb-4">
      <button
        type="button"
        onClick={sendEnkazSos}
        disabled={loading}
        className="w-full py-5 rounded-2xl border-2 border-violet-500 bg-violet-950/70 hover:bg-violet-900/80 disabled:opacity-60 transition-colors text-left px-5 shadow-lg shadow-violet-950/40"
      >
        <span className="text-3xl" aria-hidden>
          🆘
        </span>
        <span className="block text-lg font-bold text-violet-100 mt-2">
          {loading ? 'Konum alınıyor…' : 'Enkaz altındayım'}
        </span>
        <span className="block text-sm text-violet-200/80 mt-1">
          Tek tuş · GPS · Giriş gerekmez
        </span>
      </button>

      {message && (
        <p className="mt-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
