import { useState } from 'react';
import {
  validateLogin,
  saveSession,
  LOGIN_HINTS,
} from '../data/authCredentials.js';
import AppLogo from './AppLogo.jsx';
import EnkazSosButton from './EnkazSosButton.jsx';
import {
  saveEmergencySession,
  registerEmergencyServiceWorker,
  snapshotAppState,
  getEmergencyMapData,
} from '../utils/offlineCache.js';

export default function LoginScreen({ onLogin, onEmergencyMode }) {
  const [role, setRole] = useState('user');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!validateLogin(role, username, password)) {
      setError('Kullanıcı adı veya şifre hatalı.');
      return;
    }
    const session = {
      role,
      username: username.trim().toLowerCase(),
      label: LOGIN_HINTS[role].label,
    };
    saveSession(session);
    onLogin(session);
  };

  const enterEmergency = async () => {
    setError('');
    await registerEmergencyServiceWorker();
    const cached = getEmergencyMapData();
    if (!cached.savedAt) {
      snapshotAppState({
        assemblyPoints: [],
        hospitals: [],
        buildings: [],
        mapCenter: cached.mapCenter,
        mapZoom: cached.mapZoom,
      });
    }
    const session = {
      role: 'emergency',
      username: 'acil',
      label: 'Acil Mod',
      emergency: true,
    };
    saveEmergencySession(session);
    onEmergencyMode?.(session);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-rose-950/20">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <AppLogo className="h-32 w-48 mx-auto" />
        </div>

        <EnkazSosButton />

        <button
          type="button"
          onClick={enterEmergency}
          className="w-full mb-4 py-4 rounded-2xl border-2 border-red-600 bg-red-950/60 hover:bg-red-900/70 text-left px-5 transition-colors"
        >
          <span className="text-2xl" aria-hidden>
            🆘
          </span>
          <span className="block text-lg font-bold text-red-100 mt-1">Acil mod (internetsiz)</span>
          <span className="block text-sm text-red-200/70 mt-1">
            Önbellek harita — giriş şifresi gerekmez
          </span>
        </button>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-xl space-y-5"
        >
          <div className="grid grid-cols-2 gap-2">
            {(['user', 'authority']).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setError('');
                }}
                className={`py-3 rounded-xl text-base font-semibold transition-colors ${
                  role === r
                    ? r === 'user'
                      ? 'bg-sky-600 text-white'
                      : 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {r === 'user' ? '👤 Kullanıcı' : '🏛️ Yetkili'}
              </button>
            ))}
          </div>

          <label className="block text-base text-slate-300">
            Kullanıcı adı
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-600 text-lg text-white"
              placeholder={LOGIN_HINTS[role].username}
            />
          </label>

          <label className="block text-base text-slate-300">
            Şifre
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-600 text-lg text-white"
            />
          </label>

          {error && <p className="text-base text-red-400">{error}</p>}

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-lg font-bold text-white"
          >
            Giriş yap
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6 leading-relaxed">
          Demo: kullanıcı → <strong className="text-slate-400">kullanici / afet123</strong>
          <br />
          Yetkili → <strong className="text-slate-400">yetkili / afet123</strong>
        </p>
      </div>
    </div>
  );
}
