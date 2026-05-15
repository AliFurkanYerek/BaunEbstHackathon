export default function SummaryCards({ stats }) {
  const base = [
    { label: 'Bildirilen Bina', value: stats.buildingCount, icon: '🏢', color: 'text-sky-400' },
    { label: 'Tahmini Kişi (binalar)', value: stats.totalPeople, icon: '👥', color: 'text-violet-400' },
    { label: 'Su İhtiyacı (L)', value: stats.totalWater, icon: '💧', color: 'text-cyan-400' },
    { label: 'Gıda İhtiyacı (öğün)', value: stats.totalFood, icon: '🍞', color: 'text-amber-400' },
    { label: 'Battaniye', value: stats.totalBlankets, icon: '🛏️', color: 'text-pink-400' },
    { label: 'Kritik Riskli Bina', value: stats.criticalCount, icon: '⚠️', color: 'text-red-400' },
  ];

  const arrival = [
    {
      label: 'Bölgeye ulaşan (bildirim)',
      value: stats.arrivalPeople ?? 0,
      icon: '📍',
      color: 'text-emerald-400',
    },
  ];

  const cards = [...base, ...arrival];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <span className="text-xl">{card.icon}</span>
          <p className={`text-2xl font-bold mt-2 ${card.color}`}>
            {card.value.toLocaleString('tr-TR')}
          </p>
          <p className="text-xs text-slate-500 mt-1">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
