import BuildingForm from './BuildingForm.jsx';
import { calculateAidNeeds } from '../utils/riskCalculator.js';

const EMERGENCY_BUTTONS = [
  { id: 'enkaz', label: 'Enkaz altındayım', bonus: 40 },
  { id: 'yarali', label: 'Yaralı var', bonus: 35 },
  { id: 'yangin', label: 'Yangın var', bonus: 30 },
  { id: 'ses', label: 'Ses geliyor', bonus: 25 },
  { id: 'cocuk_yasli', label: 'Çocuk / yaşlı var', bonus: 30 },
];

export default function Sidebar({
  buildings,
  safeZones,
  onAddBuilding,
  onEmergency,
  selectedBuildingId,
  onSelectBuilding,
}) {
  const toplamYardim = buildings.reduce(
    (acc, b) => {
      const y = calculateAidNeeds(b.kisiSayisi);
      return {
        su: acc.su + y.su,
        gida: acc.gida + y.gida,
        battaniye: acc.battaniye + y.battaniye,
      };
    },
    { su: 0, gida: 0, battaniye: 0 }
  );

  return (
    <aside className="w-80 shrink-0 h-full flex flex-col bg-slate-900 border-r border-slate-800 overflow-hidden">
      <header className="p-4 border-b border-slate-800">
        <h1 className="text-lg font-bold text-white">Afet Koordinasyon</h1>
        <p className="text-xs text-slate-400 mt-0.5">Deprem sonrası saha yönetimi</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <BuildingForm onSubmit={onAddBuilding} />

        <section>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
            Acil Durum
          </h3>
          <p className="text-xs text-slate-500 mb-2">
            Önce listeden bina seçin, sonra acil durumu bildirin (risk puanı artar).
          </p>
          <div className="space-y-1.5">
            {EMERGENCY_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                type="button"
                disabled={!selectedBuildingId}
                onClick={() => onEmergency(selectedBuildingId, btn.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 hover:border-red-500/50 hover:bg-red-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                🚨 {btn.label}
                <span className="text-xs text-slate-500 ml-1">+{btn.bonus}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
            Risk Sıralaması
          </h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {buildings.length === 0 && (
              <li className="text-xs text-slate-500">Henüz bina yok</li>
            )}
            {buildings.map((b, i) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelectBuilding(b.id)}
                  className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                    selectedBuildingId === b.id
                      ? 'border-teal-500 bg-teal-950/40'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <span className="text-slate-500 text-xs">#{i + 1}</span>{' '}
                  <span className="font-medium">{b.ad}</span>
                  <div className="flex justify-between mt-1 text-xs text-slate-400">
                    <span>Risk: {b.riskPuani}</span>
                    <span>Hasar: {b.hasarSeviyesi}/5</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">
            Toplam Yardım İhtiyacı
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="font-bold text-sky-400">{toplamYardim.su}</p>
              <p className="text-xs text-slate-500">L su</p>
            </div>
            <div>
              <p className="font-bold text-amber-400">{toplamYardim.gida}</p>
              <p className="text-xs text-slate-500">öğün</p>
            </div>
            <div>
              <p className="font-bold text-violet-400">{toplamYardim.battaniye}</p>
              <p className="text-xs text-slate-500">battaniye</p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">
            Güvenli Bölgeler ({safeZones.length})
          </h3>
          <ul className="text-xs text-slate-400 space-y-1">
            {safeZones.map((z) => (
              <li key={z.id}>🛡️ {z.ad}</li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
