import { useEffect, useState } from 'react';
import { Siren, MapPin, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { SosReport } from '../types';

interface Command {
  id: string;
  label: string;
  icon: string;
}

interface PriorityResult {
  priorityScore: number;
  reasoning: string;
  recommendedTeams: string[];
}

export default function Emergency() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [commands, setCommands] = useState<Command[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<{ report: SosReport; priority: PriorityResult } | null>(null);
  const [queue, setQueue] = useState<SosReport[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ commands: Command[] }>('/sos/commands').then((r) => setCommands(r.commands));
    if (isAdmin) {
      api<{ reports: SosReport[] }>('/sos').then((r) => setQueue(r.reports));
    }
  }, [isAdmin]);

  const getLocation = () => {
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocation({ lat: 39.5004, lng: 26.9762 });
        setError('GPS alınamadı — demo konum kullanılıyor');
        setLocating(false);
      }
    );
  };

  const sendSos = async () => {
    if (!selected || !location) return;
    setError('');
    try {
      const res = await api<{ report: SosReport; priority: PriorityResult }>('/sos', {
        method: 'POST',
        body: JSON.stringify({
          command_type: selected,
          lat: location.lat,
          lng: location.lng,
          description,
        }),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderilemedi');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await api(`/sos/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const r = await api<{ reports: SosReport[] }>('/sos');
    setQueue(r.reports);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-red-500/20">
            <Siren className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Acil SOS</h2>
            <p className="text-slate-400 text-sm">
              112 yoğunken yapay zeka destekli öncelikli kurtarma yönlendirmesi
            </p>
          </div>
        </div>
      </header>

      {!isAdmin && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-300 mb-3">Acil durumunuzu seçin</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {commands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => setSelected(cmd.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selected === cmd.id
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl mr-2">{cmd.icon}</span>
                  <span className="font-medium">{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={getLocation}
            disabled={locating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700"
          >
            <MapPin className="w-4 h-4" />
            {locating ? 'Konum alınıyor...' : location ? 'Konum güncellendi' : 'Konumumu paylaş'}
          </button>
          {location && (
            <p className="text-xs text-slate-500">
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ek bilgi (isteğe bağlı)"
            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 min-h-[80px]"
          />

          {error && <p className="text-amber-400 text-sm">{error}</p>}

          <button
            onClick={sendSos}
            disabled={!selected || !location}
            className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-lg disabled:opacity-40 transition-colors"
          >
            ACİL ÇAĞRI GÖNDER
          </button>

          {result && (
            <div className="p-5 rounded-xl bg-slate-900 border border-brand-700/50">
              <div className="flex items-center gap-2 text-brand-400 mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Çağrı alındı — Öncelik: {result.priority.priorityScore.toFixed(0)}/100</span>
              </div>
              <p className="text-sm text-slate-300 mb-3">{result.priority.reasoning}</p>
              <p className="text-sm">
                <span className="text-slate-500">Önerilen ekipler: </span>
                {result.priority.recommendedTeams.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div>
          <h3 className="font-semibold mb-4">AI Öncelik Kuyruğu</h3>
          <div className="space-y-3">
            {queue.length === 0 && (
              <p className="text-slate-500">Bekleyen çağrı yok</p>
            )}
            {queue.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-medium">
                      {r.command_type} — Skor: {r.priority_score.toFixed(0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{r.ai_reasoning}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {r.lat.toFixed(4)}, {r.lng.toFixed(4)} · {r.user_name}
                    </p>
                  </div>
                  <select
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value)}
                    className="text-sm bg-slate-800 border border-slate-700 rounded px-2 py-1"
                  >
                    <option value="pending">Bekliyor</option>
                    <option value="dispatched">Sevk edildi</option>
                    <option value="resolved">Çözüldü</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
