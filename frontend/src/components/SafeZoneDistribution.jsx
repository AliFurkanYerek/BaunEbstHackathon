import { useMemo, useState } from 'react';
import { groupDistributionByCity } from '../utils/safeZonesByCity.js';

function ZoneRows({ rows }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
          <th className="pr-2 py-2">Güvenli bölge</th>
          <th className="pr-2">Kapas.</th>
          <th className="pr-2">Yönlen.</th>
          <th className="pr-2">Ulaşan</th>
          <th className="pr-2">Doluluk</th>
          <th className="pr-2 text-cyan-200/90" title="Bina tahminine göre">
            Su (bina)
          </th>
          <th className="pr-2 text-cyan-200/90">Gıda (b)</th>
          <th className="pr-2 text-cyan-200/90">Batt. (b)</th>
          <th className="pr-2 text-emerald-200/90" title="Ulaşan bildirimine göre gönderilmeli">
            Su (ulaşan)
          </th>
          <th className="pr-2 text-emerald-200/90">Gıda (u)</th>
          <th className="text-emerald-200/90">Batt. (u)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.zoneId} className="border-t border-slate-800/80">
            <td className="font-medium text-white py-2 pr-2">{row.zoneName}</td>
            <td>{row.capacity}</td>
            <td>{row.assignedPeople}</td>
            <td className={row.arrivedPeople > 0 ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
              {row.arrivedPeople ?? 0}
            </td>
            <td>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[72px]">
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
                <span className="text-xs whitespace-nowrap">%{row.utilizationPercent}</span>
              </div>
              {(row.arrivedPeople ?? 0) > 0 && (
                <span className="text-[10px] text-slate-500 block">
                  bina %{row.buildingUtilizationPercent ?? 0}
                </span>
              )}
            </td>
            <td className="text-slate-300">{row.aidNeeded?.water ?? 0}</td>
            <td className="text-slate-300">{row.aidNeeded?.food ?? 0}</td>
            <td className="text-slate-300">{row.aidNeeded?.blankets ?? 0}</td>
            <td className="text-emerald-300/95">{row.arrivalAid?.water ?? 0}</td>
            <td className="text-emerald-300/95">{row.arrivalAid?.food ?? 0}</td>
            <td className="text-emerald-300/95">{row.arrivalAid?.blankets ?? 0}</td>
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
    Object.fromEntries(cityGroups.map((g) => [g.city, g.totalAssigned > 0 || (g.totalArrived ?? 0) > 0]))
  );

  const toggle = (city) => {
    setExpanded((prev) => ({ ...prev, [city]: !prev[city] }));
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="font-semibold text-white">Güvenli Bölge Dağılımı</h3>
        <p className="text-xs text-slate-500 mt-1">
          Doluluk, binalardan yönlendirilen kişi + kullanıcı &quot;buradayım&quot; bildirimi toplamına göredir.
          Yeşil sütunlar: ulaşan kişi sayısına göre gönderilmesi önerilen malzeme (su 3 L/kişi, gıda 2 öğün/kişi,
          battaniye 1/kişi).
        </p>
      </div>
      <div className="divide-y divide-slate-800 max-h-[520px] overflow-y-auto">
        {cityGroups.map((group) => {
          const isOpen = expanded[group.city] ?? false;
          const activeRows = group.rows.filter((r) => r.assignedPeople > 0 || (r.arrivedPeople ?? 0) > 0);
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
                  <span className="text-xs text-slate-500 ml-2">{group.zoneCount} alan</span>
                </div>
                <div className="text-right text-xs shrink-0 space-y-0.5">
                  <div>
                    <span className="text-indigo-300">
                      yönlen.: {group.totalAssigned.toLocaleString('tr-TR')}
                    </span>
                    {(group.totalArrived ?? 0) > 0 && (
                      <span className="text-emerald-400 ml-2">
                        · ulaşan: {(group.totalArrived ?? 0).toLocaleString('tr-TR')}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500">
                    kapasite: {group.totalCapacity.toLocaleString('tr-TR')}
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className="table-scroll px-2 pb-3 overflow-x-auto">
                  <ZoneRows rows={displayRows} />
                  {group.rows.length > displayRows.length && !activeRows.length && (
                    <p className="text-xs text-slate-500 px-2 pt-2">
                      +{group.rows.length - displayRows.length} alan (boş özet)
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
