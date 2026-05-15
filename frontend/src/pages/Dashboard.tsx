import { useEffect, useState } from 'react';
import { Building2, Users, Siren, Package } from 'lucide-react';
import { api } from '../api/client';

interface DashboardData {
  stats: {
    buildingCount: number;
    zoneCount: number;
    pendingSos: number;
    collapsedBuildings: number;
  };
  totalAidDeficit: {
    water: number;
    food: number;
    medical: number;
    blankets: number;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api<DashboardData>('/analysis/dashboard').then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-8 flex items-center justify-center h-full text-slate-400">
        Yükleniyor...
      </div>
    );
  }

  const cards = [
    {
      label: 'Kayıtlı Bina',
      value: data.stats.buildingCount,
      icon: Building2,
      color: 'text-blue-400',
    },
    {
      label: 'Güvenli Bölge',
      value: data.stats.zoneCount,
      icon: Users,
      color: 'text-teal-400',
    },
    {
      label: 'Bekleyen SOS',
      value: data.stats.pendingSos,
      icon: Siren,
      color: 'text-red-400',
    },
    {
      label: 'Ağır Hasarlı Bina',
      value: data.stats.collapsedBuildings,
      icon: Building2,
      color: 'text-orange-400',
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold">Operasyon Paneli</h2>
        <p className="text-slate-400">Anlık afet koordinasyon özeti</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="p-5 rounded-xl bg-slate-900 border border-slate-800"
          >
            <Icon className={`w-8 h-8 mb-3 ${color}`} />
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-lg">Toplam Yardım Açığı</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Tahliye planına göre güvenli bölgelere gönderilmesi gereken ek kaynaklar
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AidItem label="Su (L)" value={data.totalAidDeficit.water} />
          <AidItem label="Gıda (porsiyon)" value={data.totalAidDeficit.food} />
          <AidItem label="İlk yardım kiti" value={data.totalAidDeficit.medical} />
          <AidItem label="Battaniye" value={data.totalAidDeficit.blankets} />
        </div>
      </div>
    </div>
  );
}

function AidItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-lg bg-slate-800/50 text-center">
      <p className="text-2xl font-bold text-amber-400">{value.toLocaleString('tr-TR')}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
