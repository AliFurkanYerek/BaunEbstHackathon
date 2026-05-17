import { useMemo } from 'react';
import {
  MERGE_RADIUS_KM,
  buildMergedRiskRows,
  buildPhotoRiskRows,
  buildUserRiskRows,
} from '../utils/riskAggregation.js';

function riskClass(score) {
  if (score >= 250) return 'text-red-400';
  if (score >= 150) return 'text-orange-400';
  return 'text-yellow-400';
}

function RiskScore({ value }) {
  return <strong className={riskClass(value)}>{value}</strong>;
}

function TableShell({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="table-scroll max-h-[280px] overflow-auto">{children}</div>
    </div>
  );
}

function PhotoRiskTable({ rows }) {
  return (
    <TableShell
      title="1 · Fotoğraf (yıkık / enkaz tespiti)"
      subtitle="Roboflow + GeoSeer konum — risk: yıkık kutu × 45 + hasar seviyesi × 25"
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-900">
          <tr className="text-left text-xs text-slate-500 uppercase">
            <th className="p-2">#</th>
            <th className="p-2">Foto / adres</th>
            <th className="p-2">Yıkık</th>
            <th className="p-2">Hasar</th>
            <th className="p-2">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-slate-500 text-xs">
                Henüz konumlu fotoğraf analizi yok. Yetkili panelde fotoğraf yükleyip analiz edin.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.id} className="border-t border-slate-800/80">
                <td className="p-2 text-slate-500">{i + 1}</td>
                <td className="p-2">
                  <div className="font-medium text-white text-xs">{r.name}</div>
                  <div className="text-[10px] text-slate-500">{r.street}</div>
                </td>
                <td className="p-2 text-red-300">{r.collapsed}</td>
                <td className="p-2">{r.damageLevel}/5</td>
                <td className="p-2">
                  <RiskScore value={r.riskScore} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableShell>
  );
}

function UserRiskTable({ rows }) {
  return (
    <TableShell
      title="2 · Kullanıcı bildirimleri"
      subtitle="Sarı: kullanıcı paneli · Mor (ana sayfa): enkaz SOS risk 500"
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-900">
          <tr className="text-left text-xs text-slate-500 uppercase">
            <th className="p-2">#</th>
            <th className="p-2">Bina</th>
            <th className="p-2">Kişi</th>
            <th className="p-2">Acil durum</th>
            <th className="p-2">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-slate-500 text-xs">
                Kullanıcı panelinden haritada konum seçilerek bildirim yapılmalı.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr
                key={r.id}
                className={`border-t border-slate-800/80 ${r.kind === 'enkaz_sos' ? 'bg-violet-950/30' : ''}`}
              >
                <td className="p-2 text-slate-500">{i + 1}</td>
                <td
                  className={`p-2 font-medium text-xs ${r.kind === 'enkaz_sos' ? 'text-violet-300' : 'text-white'}`}
                >
                  {r.name}
                </td>
                <td className="p-2">{r.peopleCount}</td>
                <td className="p-2 text-[10px] max-w-[140px]">
                  {r.emergencyLabels.join(' · ')}
                </td>
                <td className="p-2">
                  <RiskScore value={r.riskScore} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableShell>
  );
}

function MergedRiskTable({ rows }) {
  return (
    <TableShell
      title={`3 · Ana risk sıralaması (${MERGE_RADIUS_KM.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km birleştirme)`}
      subtitle={`≤${MERGE_RADIUS_KM.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km içinde foto+kullanıcı veya birden fazla kullanıcı bildirimi tek satırda toplanır`}
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-900">
          <tr className="text-left text-xs text-slate-500 uppercase">
            <th className="p-2">#</th>
            <th className="p-2">Kaynak</th>
            <th className="p-2">Konum</th>
            <th className="p-2">Foto</th>
            <th className="p-2">Kullanıcı</th>
            <th className="p-2">Toplam</th>
            <th className="p-2">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-6 text-center text-slate-500 text-xs">
                Birleştirilecek veri yok.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.id} className="border-t border-slate-800/80">
                <td className="p-2 text-slate-500">{i + 1}</td>
                <td className="p-2 text-xs">
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      r.mergeType === 'photo_user'
                        ? 'bg-violet-900/50 text-violet-200'
                        : r.mergeType === 'user_user'
                          ? 'bg-sky-900/60 text-sky-100'
                          : r.mergeType === 'photo_only'
                            ? 'bg-pink-900/40 text-pink-200'
                            : 'bg-sky-900/40 text-sky-200'
                    }`}
                  >
                    {r.mergeType === 'photo_user'
                      ? 'Foto + kullanıcı'
                      : r.mergeType === 'user_user'
                        ? 'Kullanıcı kümesi'
                        : r.mergeType === 'photo_only'
                          ? 'Yalnız foto'
                          : 'Yalnız kullanıcı'}
                  </span>
                  {r.distanceKm != null && (
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      ≈ {r.distanceKm} km
                    </span>
                  )}
                </td>
                <td className="p-2 text-[10px] text-slate-400 max-w-[120px]">
                  {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                </td>
                <td className="p-2 text-pink-300/90">{r.photoRisk || '—'}</td>
                <td className="p-2 text-sky-300/90">{r.userRisk || '—'}</td>
                <td className="p-2">
                  <RiskScore value={r.riskScore} />
                </td>
                <td className="p-2 text-[10px] text-indigo-300 max-w-[140px]">
                  {r.suggestedAction}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableShell>
  );
}

export default function RiskAggregationPanel({ buildings, photoReports }) {
  const photoRows = useMemo(
    () => buildPhotoRiskRows(photoReports).sort((a, b) => b.riskScore - a.riskScore),
    [photoReports]
  );
  const userRows = useMemo(
    () => buildUserRiskRows(buildings).sort((a, b) => b.riskScore - a.riskScore),
    [buildings]
  );
  const mergedRows = useMemo(
    () => buildMergedRiskRows(photoRows, userRows),
    [photoRows, userRows]
  );

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PhotoRiskTable rows={photoRows} />
        <UserRiskTable rows={userRows} />
      </div>

      <MergedRiskTable rows={mergedRows} />
    </section>
  );
}
