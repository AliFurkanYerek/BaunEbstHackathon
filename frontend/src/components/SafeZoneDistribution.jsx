export default function SafeZoneDistribution({ distribution }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="font-semibold text-white">Güvenli Bölge Dağılımı</h3>
        <p className="text-xs text-slate-500">
          Kapasiteye göre otomatik yönlendirme ve yardım ihtiyacı
        </p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Güvenli Bölge</th>
              <th>Kapasite</th>
              <th>Yönlendirilen</th>
              <th>Doluluk</th>
              <th>Su (L)</th>
              <th>Gıda (öğün)</th>
              <th>Battaniye</th>
            </tr>
          </thead>
          <tbody>
            {distribution.map((row) => (
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
      </div>
    </div>
  );
}
