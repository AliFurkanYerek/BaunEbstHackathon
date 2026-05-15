import { useMemo, useState, useEffect } from 'react';
import { ALL_CITIES } from '../utils/safeZonesByCity.js';

/**
 * Kullanıcı güvenli bölgeye ulaştığını bildirir (doluluk ve malzeme için yetkili panele düşer).
 */
export default function SafeZoneCheckIn({
  zonesByCity,
  selectedMapCity,
  nearestInfo,
  onArrival,
}) {
  const [checkInCity, setCheckInCity] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [msg, setMsg] = useState('');

  const cityOptions = useMemo(
    () => (zonesByCity || []).map((g) => g.city).sort((a, b) => a.localeCompare(b, 'tr')),
    [zonesByCity]
  );

  const zonesInSelectedCity = useMemo(() => {
    if (!checkInCity) return [];
    const g = zonesByCity?.find((x) => x.city === checkInCity);
    return g?.zones || [];
  }, [checkInCity, zonesByCity]);

  // Harita il filtresi ile aynı ili öner
  const effectiveCity =
    selectedMapCity && selectedMapCity !== ALL_CITIES ? selectedMapCity : checkInCity;

  useEffect(() => {
    setZoneId('');
  }, [selectedMapCity, checkInCity]);

  const zonesForDropdown = useMemo(() => {
    if (selectedMapCity && selectedMapCity !== ALL_CITIES) {
      const g = zonesByCity?.find((x) => x.city === selectedMapCity);
      return g?.zones || [];
    }
    return zonesInSelectedCity;
  }, [selectedMapCity, zonesByCity, zonesInSelectedCity]);

  const submit = (e) => {
    e.preventDefault();
    const zid = zoneId;
    if (!zid) {
      setMsg('Listeden toplanma alanı seçin (veya yukarıdan “en yakın alan” butonunu kullanın).');
      return;
    }
    const n = Math.max(1, Math.min(5000, Number(peopleCount) || 1));
    onArrival({ zoneId: zid, peopleCount: n });
    setMsg('Bildiriminiz kaydedildi. Yetkili panelinde doluluk güncellendi.');
    setPeopleCount(1);
  };

  const quickNearest = () => {
    if (!nearestInfo?.id) {
      setMsg('Önce haritada konumunuzu işaretleyerek en yakın alanı görün.');
      return;
    }
    const n = Math.max(1, Math.min(5000, Number(peopleCount) || 1));
    onArrival({ zoneId: nearestInfo.id, peopleCount: n });
    setMsg(`“${nearestInfo.name}” alanı için ulaştım bildirimi kaydedildi.`);
    setPeopleCount(1);
  };

  return (
    <div className="p-4 rounded-xl bg-emerald-950/35 border border-emerald-800/50 space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <span aria-hidden>📍</span> Güvenli bölgedeyim
      </h3>
      <p className="text-xs text-emerald-200/80 leading-relaxed">
        Toplanma alanına vardığınızda buradan bildirin; yetkili panelinde alan doluluğu ve bölgeye gönderilecek
        tahmini malzeme (su, gıda, battaniye) güncellenir.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs text-slate-400">Kişi sayısı (siz dahil)</label>
        <input
          type="number"
          min={1}
          max={5000}
          value={peopleCount}
          onChange={(e) => setPeopleCount(e.target.value)}
          className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
        />
      </div>

      {nearestInfo?.id && (
        <button
          type="button"
          onClick={quickNearest}
          className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          En yakın alana ulaştım: <span className="font-semibold">{nearestInfo.name}</span>
          {nearestInfo.il ? ` (${nearestInfo.il})` : ''}
        </button>
      )}

      <form onSubmit={submit} className="space-y-2 pt-1 border-t border-emerald-800/40">
        <p className="text-xs text-slate-500">Manuel seçim</p>
        {(!selectedMapCity || selectedMapCity === ALL_CITIES) && (
          <select
            value={checkInCity}
            onChange={(e) => {
              setCheckInCity(e.target.value);
              setZoneId('');
            }}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
          >
            <option value="">İl seçin</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <select
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
        >
          <option value="">
            {effectiveCity && effectiveCity !== ALL_CITIES ? 'Toplanma alanı seçin' : 'Önce il seçin'}
          </option>
          {zonesForDropdown.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name?.slice(0, 80)}
              {z.ilce ? ` — ${z.ilce}` : ''}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
        >
          Bu alana ulaştığımı bildir
        </button>
      </form>

      {msg && <p className="text-xs text-emerald-300">{msg}</p>}
    </div>
  );
}
