import { useState, useEffect } from 'react';
import { EMERGENCY_TYPES } from '../data/sampleData.js';

export default function BuildingForm({ onSubmit, selectedCoords, onClearCoords }) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [fromMap, setFromMap] = useState(false);
  const [emergencyTypes, setEmergencyTypes] = useState([]);
  const [emergencyError, setEmergencyError] = useState('');

  useEffect(() => {
    if (selectedCoords) {
      setLat(String(selectedCoords.lat));
      setLng(String(selectedCoords.lng));
      setFromMap(true);
    }
  }, [selectedCoords]);

  const toggleEmergency = (id) => {
    setEmergencyError('');
    setEmergencyTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!lat || !lng) return;

    if (emergencyTypes.length === 0) {
      setEmergencyError('En az bir acil durum tipi seçin');
      return;
    }

    onSubmit({
      name: e.target.name.value,
      street: e.target.street.value,
      peopleCount: Number(e.target.peopleCount.value),
      damageLevel: Number(e.target.damageLevel.value),
      emergencyTypes: [...emergencyTypes],
      description: e.target.description.value,
      lat: Number(lat),
      lng: Number(lng),
    });

    e.target.reset();
    setLat('');
    setLng('');
    setFromMap(false);
    setEmergencyTypes([]);
    setEmergencyError('');
    onClearCoords?.();
  };

  const coordReady = lat !== '' && lng !== '';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
      <h3 className="font-semibold text-white">Bina Bildirimi</h3>

      <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
        <li>Üstteki haritada hasarlı binanın yerine tıklayın</li>
        <li>Formu doldurun, acil durumları işaretleyin</li>
        <li>En alttan gönderin</li>
      </ol>

      {fromMap && coordReady ? (
        <div className="px-3 py-2.5 rounded-lg bg-emerald-950/50 border border-emerald-700/50 text-emerald-300 text-xs">
          ✓ Konum: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
        </div>
      ) : (
        <div className="px-3 py-2.5 rounded-lg bg-amber-950/40 border border-amber-700/40 text-amber-300 text-xs">
          ⚠ Önce haritada konum işaretleyin
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <CoordField label="Enlem" value={lat} fromMap={fromMap} />
        <CoordField label="Boylam" value={lng} fromMap={fromMap} />
      </div>

      <Field label="Bina adı" name="name" required placeholder="Örn: Yeşil Apartman" disabled={!coordReady} />
      <Field label="Sokak / mahalle" name="street" required placeholder="Örn: Cumhuriyet Mah." disabled={!coordReady} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Tahmini kişi" name="peopleCount" type="number" min={0} required disabled={!coordReady} />
        <label className="block">
          <span className="text-xs text-slate-400">Hasar (1–5)</span>
          <select
            name="damageLevel"
            defaultValue={3}
            disabled={!coordReady}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm disabled:opacity-50"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset disabled={!coordReady} className="disabled:opacity-50">
        <legend className="text-xs text-slate-400 mb-2 block">
          Acil durum tipleri — birden fazla seçebilirsiniz
        </legend>
        <ul className="space-y-2 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
          {EMERGENCY_TYPES.map((t) => {
            const checked = emergencyTypes.includes(t.id);
            return (
              <li key={t.id}>
                <label
                  className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    checked
                      ? 'bg-red-950/40 border border-red-700/50'
                      : 'hover:bg-slate-700/50 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEmergency(t.id)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-600 text-red-600 focus:ring-red-500"
                  />
                  <span className="flex-1 text-sm text-slate-200">{t.label}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">+{t.coefficient}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {emergencyError && (
          <p className="text-xs text-red-400 mt-1">{emergencyError}</p>
        )}
        {emergencyTypes.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {emergencyTypes.length} durum seçildi
          </p>
        )}
      </fieldset>

      <label className="block">
        <span className="text-xs text-slate-400">Açıklama</span>
        <textarea
          name="description"
          rows={2}
          disabled={!coordReady}
          className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm resize-none disabled:opacity-50"
          placeholder="Ek bilgi..."
        />
      </label>

      <button
        type="submit"
        disabled={!coordReady}
        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {coordReady ? 'Bildirimi Gönder' : 'Önce haritada konum seçin'}
      </button>
    </form>
  );
}

function CoordField({ label, value, fromMap }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label} (otomatik)</span>
      <input
        type="text"
        readOnly
        value={value}
        placeholder="Haritadan"
        className={`mt-1 w-full px-3 py-2 rounded-lg border text-sm ${
          fromMap && value
            ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-100'
            : 'bg-slate-800 border-slate-700 text-slate-500'
        }`}
      />
    </label>
  );
}

function Field({ label, name, disabled, ...props }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        name={name}
        disabled={disabled}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        {...props}
      />
    </label>
  );
}
