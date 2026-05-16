import { useMemo } from 'react';
import { buildPhotoRiskRows, buildUserRiskRows } from '../utils/riskAggregation.js';

function confirmDelete(message) {
  return window.confirm(message);
}

export default function AuthorityRecordManager({
  buildings,
  photoReports,
  onDeletePhoto,
  onDeleteBuilding,
}) {
  const photoRows = useMemo(
    () => buildPhotoRiskRows(photoReports).sort((a, b) => b.riskScore - a.riskScore),
    [photoReports]
  );
  const userRows = useMemo(
    () => buildUserRiskRows(buildings).sort((a, b) => b.riskScore - a.riskScore),
    [buildings]
  );

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="font-semibold text-white text-sm">Harita kayıtları — silme</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-slate-800">
        <div className="p-4">
          <h4 className="text-xs font-semibold text-orange-300 uppercase mb-2">
            Enkaz / fotoğraf ({photoRows.length})
          </h4>
          {photoRows.length === 0 ? (
            <p className="text-xs text-slate-500">Kayıtlı enkaz konumu yok.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {photoRows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div className="min-w-0 text-xs">
                    <p className="font-medium text-white truncate">{r.name}</p>
                    <p className="text-slate-500 truncate">{r.street}</p>
                    <p className="text-slate-400 mt-0.5">
                      Yıkık {r.collapsed} · Risk {r.riskScore}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirmDelete(
                          `"${r.name}" enkaz kaydını silmek istiyor musunuz? Haritadan kaldırılır.`
                        )
                      ) {
                        onDeletePhoto?.(r.id);
                      }
                    }}
                    className="shrink-0 px-2 py-1 rounded text-[10px] font-medium bg-red-950/60 text-red-300 border border-red-900/50 hover:bg-red-900/50"
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4">
          <h4 className="text-xs font-semibold text-sky-300 uppercase mb-2">
            Kullanıcı bildirimleri ({userRows.length})
          </h4>
          {userRows.length === 0 ? (
            <p className="text-xs text-slate-500">Kullanıcı bildirimi yok.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {userRows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div className="min-w-0 text-xs">
                    <p className="font-medium text-white truncate">{r.name}</p>
                    <p className="text-slate-500 truncate">{r.street}</p>
                    <p className="text-slate-400 mt-0.5">
                      {r.peopleCount} kişi · Risk {r.riskScore}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirmDelete(
                          `"${r.name}" kullanıcı bildirimini silmek istiyor musunuz? Haritadan kaldırılır.`
                        )
                      ) {
                        onDeleteBuilding?.(r.id);
                      }
                    }}
                    className="shrink-0 px-2 py-1 rounded text-[10px] font-medium bg-red-950/60 text-red-300 border border-red-900/50 hover:bg-red-900/50"
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
