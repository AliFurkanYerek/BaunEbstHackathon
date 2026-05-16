import AppLogo from './AppLogo.jsx';

export default function Navbar({ session, onLogout, online = true }) {
  const isAuthority = session?.role === 'authority';

  return (
    <nav className="shrink-0 border-b border-amber-900/30 bg-slate-900/95 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <AppLogo className="h-10 w-14" showText />

        <div className="flex items-center gap-3">
          {!online && (
            <span className="text-xs px-2 py-1 rounded bg-red-900/80 text-red-200 border border-red-700">
              Çevrimdışı
            </span>
          )}
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isAuthority
                ? 'bg-rose-600/30 text-rose-200 border border-rose-500/40'
                : 'bg-sky-600/30 text-sky-200 border border-sky-500/40'
            }`}
          >
            {session?.label || (isAuthority ? 'Yetkili' : 'Kullanıcı')}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-slate-600 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Çıkış
          </button>
        </div>
      </div>
    </nav>
  );
}
