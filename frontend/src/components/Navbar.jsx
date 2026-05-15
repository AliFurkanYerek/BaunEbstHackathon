export default function Navbar({ activePlatform, onPlatformChange }) {
  const tabs = [
    { id: 'user', label: 'Kullanıcı Paneli' },
    { id: 'authority', label: 'Yetkili Paneli' },
  ];

  return (
    <nav className="shrink-0 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            🛡️
          </span>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">
              AfetKoordinasyon AI
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
              Dijital Afet Yönetimi
            </p>
          </div>
        </div>

        <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onPlatformChange(tab.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activePlatform === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
