import { useEffect, useState } from 'react';
import {
  startEmergencySiren,
  stopEmergencySiren,
  isEmergencySirenActive,
} from '../utils/emergencySirenWeb.js';

export default function EmergencySirenButton() {
  const [active, setActive] = useState(isEmergencySirenActive());
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    if (!active) {
      setFlashOn(false);
      return undefined;
    }
    const id = setInterval(() => setFlashOn((v) => !v), 140);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => () => stopEmergencySiren(), []);

  const toggle = async () => {
    if (active) {
      await stopEmergencySiren();
      setActive(false);
    } else {
      try {
        await startEmergencySiren();
        setActive(true);
      } catch {
        alert('Ses başlatılamadı. Önce sayfaya bir kez dokunun (tarayıcı kuralı).');
      }
    }
  };

  return (
    <>
      {active && (
        <div
          className="fixed inset-0 z-[9999] pointer-events-none transition-opacity duration-75"
          style={{
            backgroundColor: flashOn ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,0,0.12)',
          }}
          aria-hidden
        />
      )}

      <div className="shrink-0 border-t border-red-900/60 bg-slate-900 p-3">
        <p className="text-[11px] text-slate-400 mb-2 text-center">
          İnternet gerekmez · Kamera flaşı için Flutter mobil uygulama
        </p>
        <button
          type="button"
          onClick={toggle}
          className={`w-full py-5 rounded-2xl font-bold text-xl tracking-wide transition-colors ${
            active
              ? 'bg-white text-red-800'
              : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50'
          }`}
        >
          {active ? '⏹ DURDUR' : '📢 SES ÇIKAR'}
        </button>
        {active && (
          <p className="text-center text-amber-300 text-xs mt-2 animate-pulse">
            Düdük + ekran flaşı aktif
          </p>
        )}
      </div>
    </>
  );
}
