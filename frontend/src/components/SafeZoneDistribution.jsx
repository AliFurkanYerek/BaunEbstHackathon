import { useMemo, useState } from 'react';
import { groupDistributionByCity } from '../utils/safeZonesByCity.js';

function ZoneRows({ rows }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Güvenli Bölge</th>
          <th>Kapasite</th>
          <th>Yönlendirilen</th>
          <th>Doluluk</th>
          <th>Su (L)</th>
          <th>Gıda</th>
          <th>Battaniye</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.zoneId}>
            <td className="font-medium text-white">{row.zoneName}</td>
            <td>{row.capacity}</td>
            <td>{row.assignedPeople}</td>
            <td>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[80px]">
                  <div
                    className={`h-full rounded-full ${
                      row.utilizationPercent > 90
                        ? 'bg-red-500'
                        : row.utilizationPercent > 70
                          ? 'bg-amber-500'
                          : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, row.utilizationPercent)}%` }}
                  />
                </div>
                <span className="text-xs">%{row.utilizationPercent}</span>
              </div>
            </td>
            <td>{row.aidNeeded.water}</td>
            <td>{row.aidNeeded.food}</td>
            <td>{row.aidNeeded.blankets}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SafeZoneDistribution({ distribution, safeZones = [] }) {
  const cityGroups = useMemo(
    () => groupDistributionByCity(distribution, safeZones),
    [distribution, safeZones]
  );

  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(cityGroups.map((g) => [g.city, g.totalAssigned > 0]))
  );

  const toggle = (city) => {
    setExpanded((prev) => ({ ...prev, [city]: !prev[city] }));
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="font-semibold text-white">Güvenli Bölge Dağılımı</h3>
        <p className="text-xs text-slate-500">
          {cityGroups.length} il · kapasiteye göre yönlendirme (şehre göre gruplu)
        </p>
      </div>
      <div className="divide-y divide-slate-800 max-h-[520px] overflow-y-auto">
        {cityGroups.map((group) => {
          const isOpen = expanded[group.city] ?? false;
          const activeRows = group.rows.filter((r) => r.assignedPeople > 0);
          const displayRows = isOpen ? group.rows : activeRows.length ? activeRows : group.rows.slice(0, 5);

          return (
            <section key={group.city}>
              <button
                type="button"
                onClick={() => toggle(group.city)}
                className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-800/50 transition-colors"
              >
                <div>
                  <span className="font-medium text-white">{group.city}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {group.zoneCount} alan
                  </span>
                </div>
                <div className="text-right text-xs shrink-0">
                  <span className="text-indigo-300">
                    {group.totalAssigned.toLocaleString('tr-TR')} yönlendirilen
                  </span>
                  <span className="text-slate-500 block">
                    / {group.totalCapacity.toLocaleString('tr-TR')} kapasite
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className="table-scroll px-2 pb-3">
                  <ZoneRows rows={displayRows} />
                  {group.rows.length > displayRows.length && !activeRows.length && (
                    <p className="text-xs text-slate-500 px-2 pt-2">
                      +{group.rows.length - displayRows.length} alan (atanma yok)
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
