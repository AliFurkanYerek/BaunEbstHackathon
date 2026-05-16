import { useMemo, useState, useEffect } from 'react';
/**
 * Kullanıcı güvenli bölgeye ulaştığını bildirir (doluluk ve malzeme için yetkili panele düşer).
 */
export default function SafeZoneCheckIn({
  zonesByCity,
  onArrival,
  selectedZoneId = '',
  onZoneSelect,
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

  useEffect(() => {
    setZoneId('');
    onZoneSelect?.(null);
  }, [checkInCity]);

  useEffect(() => {
    if (selectedZoneId && selectedZoneId !== zoneId) {
      setZoneId(selectedZoneId);
    }
  }, [selectedZoneId]);

  const zonesForDropdown = zonesInSelectedCity;

  const submit = (e) => {
    e.preventDefault();
    const zid = zoneId;
    if (!zid) {
      setMsg('Listeden toplanma alanı seçin.');
      return;
    }
    const n = Math.max(1, Math.min(5000, Number(peopleCount) || 1));
    onArrival({ zoneId: zid, peopleCount: n });
    setMsg('Bildiriminiz kaydedildi. Yetkili panelinde doluluk güncellendi.');
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

      <form onSubmit={submit} className="space-y-2">
        <p className="text-xs text-slate-500">Toplanma alanı seçin (harita altta güncellenir)</p>
        <select
          value={checkInCity}
          onChange={(e) => {
            setCheckInCity(e.target.value);
            setZoneId('');
            onZoneSelect?.(null);
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
        <select
          value={zoneId}
          onChange={(e) => {
            const id = e.target.value;
            setZoneId(id);
            onZoneSelect?.(id || null);
          }}
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
        >
          <option value="">{checkInCity ? 'Toplanma alanı seçin' : 'Önce il seçin'}</option>
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
