import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 text-brand-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold">ResilienceHub</h1>
          <p className="text-slate-400 mt-2">
            Deprem sonrası koordinasyon ve kurtarma platformu
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl backdrop-blur"
        >
          <h2 className="text-xl font-semibold mb-6">Giriş Yap</h2>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <label className="block mb-4">
            <span className="text-sm text-slate-400">Kullanıcı adı</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 focus:border-brand-500 focus:outline-none"
              placeholder="yetkili veya vatandas"
              required
            />
          </label>
          <label className="block mb-6">
            <span className="text-sm text-slate-400">Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 focus:border-brand-500 focus:outline-none"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-500 font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş'}
          </button>
        </form>

        <div className="mt-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-sm text-slate-400">
          <p className="font-medium text-slate-300 mb-2">Demo hesaplar</p>
          <p>Yetkili: <code className="text-brand-400">yetkili</code> / <code>admin123</code></p>
          <p>Vatandaş: <code className="text-brand-400">vatandas</code> / <code>vatandas123</code></p>
        </div>
      </div>
    </div>
  );
}
