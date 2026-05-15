import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Map,
  LayoutDashboard,
  Building2,
  Scan,
  Siren,
  Route,
  LogOut,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Harita', icon: Map },
  { to: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { to: '/evacuation', label: 'Tahliye & Yardım', icon: Route },
  { to: '/emergency', label: 'Acil SOS', icon: Siren },
];

const adminNav = [
  { to: '/admin/buildings', label: 'Bina Verisi', icon: Building2 },
  { to: '/admin/analysis', label: 'Görüntü Analizi', icon: Scan },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900/80 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-brand-500" />
            <div>
              <h1 className="font-bold text-lg leading-tight">ResilienceHub</h1>
              <p className="text-xs text-slate-400">Afet Koordinasyon</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                location.pathname === to
                  ? 'bg-brand-700/40 text-brand-100'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Yetkili
              </p>
              {adminNav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    location.pathname.startsWith(to)
                      ? 'bg-brand-700/40 text-brand-100'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 capitalize">{user?.role === 'admin' ? 'Yetkili' : 'Vatandaş'}</p>
          <button
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Çıkış
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
