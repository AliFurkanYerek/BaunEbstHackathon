import { getEmergencyLabels, normalizeEmergencyTypes } from '../data/sampleData.js';

export default function RiskTable({ buildings }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="font-semibold text-white">Risk Sıralaması</h3>
        <p className="text-xs text-slate-500">Yüksek riskten düşüğe</p>
      </div>
      <div className="table-scroll max-h-[420px] overflow-y-auto">
        <table>
          <thead className="sticky top-0 z-10">
            <tr>
              <th>#</th>
              <th>Bina</th>
              <th>Mahalle</th>
              <th>Kişi</th>
              <th>Hasar</th>
              <th>Acil Durum</th>
              <th>Risk</th>
              <th>Güvenli Bölge</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {buildings.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-slate-500 py-8">
                  Henüz bildirim yok
                </td>
              </tr>
            )}
            {buildings.map((b, i) => (
              <tr key={b.id}>
                <td className="text-slate-500">{i + 1}</td>
                <td className="font-medium text-white">{b.name}</td>
                <td>{b.street}</td>
                <td>{b.peopleCount}</td>
                <td>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      b.damageLevel >= 4
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {b.damageLevel}/5
                  </span>
                </td>
                <td className="text-xs max-w-[180px]">
                  <ul className="space-y-0.5">
                    {getEmergencyLabels(normalizeEmergencyTypes(b)).map((label) => (
                      <li key={label} className="flex items-start gap-1">
                        <span className="text-red-400 shrink-0">•</span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </td>
                <td>
                  <strong
                    className={
                      b.riskScore >= 250
                        ? 'text-red-400'
                        : b.riskScore >= 150
                          ? 'text-orange-400'
                          : 'text-yellow-400'
                    }
                  >
                    {b.riskScore}
                  </strong>
                </td>
                <td className="text-xs">
                  {b.nearestSafeZone?.name ?? '—'}
                  {b.nearestSafeZone?.distanceKm != null && (
                    <span className="text-slate-500 block">
                      {b.nearestSafeZone.distanceKm} km
                    </span>
                  )}
                </td>
                <td className="text-xs text-indigo-300 max-w-[160px]">
                  {b.suggestedAction}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
