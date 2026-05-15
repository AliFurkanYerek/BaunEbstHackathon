import { useState, useRef, useEffect } from 'react';
import {
  sendGeminiMessage,
  getGeminiApiKey,
  setGeminiApiKey,
} from '../utils/gemini.js';

const WELCOME =
  'Merhaba! Ben afet asistanınızım. Haritada konumunuzu seçerseniz size en yakın güvenli alanı söyleyebilirim. Aşağıdaki öne çıkan sorulardan birine tıklayabilir veya kendi sorunuzu yazabilirsiniz.';

export default function Chatbot({ safeZones, selectedCoords, nearestInfo }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', text: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const listRef = useRef(null);

  const hasKey = Boolean(getGeminiApiKey() || import.meta.env.VITE_GEMINI_API_KEY);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const context = {
    safeZones,
    selectedLocation: selectedCoords,
    nearestZone: nearestInfo,
    safeZonesWithDistance: selectedCoords
      ? safeZones
          .map((z) => {
            const R = 6371;
            const dLat = ((z.lat - selectedCoords.lat) * Math.PI) / 180;
            const dLng = ((z.lng - selectedCoords.lng) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos((selectedCoords.lat * Math.PI) / 180) *
                Math.cos((z.lat * Math.PI) / 180) *
                Math.sin(dLng / 2) ** 2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return {
              name: z.name,
              lat: z.lat,
              lng: z.lng,
              distanceKm: Math.round(dist * 100) / 100,
            };
          })
          .sort((a, b) => a.distanceKm - b.distanceKm)
      : safeZones.map((z) => ({ name: z.name, lat: z.lat, lng: z.lng, distanceKm: null })),
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError('');
    const userMsg = { role: 'user', text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const history = nextMessages.filter((m) => m.role === 'user' || m.role === 'model');
      const reply = await sendGeminiMessage(history, context);
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = () => {
    setGeminiApiKey(apiKeyInput.trim());
    setApiKeyInput('');
    setShowSettings(false);
    setError('');
  };

  const quickQuestions = [
    'En yakın güvenli alan nerede?',
    'Buradan güvenli alana nasıl gidebilirim?',
    'Enkaz altında biri var, ne yapmalıyım?',
  ];

  const sendQuickQuestion = async (question) => {
    if (loading) return;
    setInput('');
    setError('');
    const userMsg = { role: 'user', text: question };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const history = nextMessages.filter((m) => m.role === 'user' || m.role === 'model');
      const reply = await sendGeminiMessage(history, context);
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed bottom-20 right-4 z-[2000] w-[min(100vw-2rem,380px)] h-[min(70vh,520px)] flex flex-col rounded-2xl border border-indigo-700/50 bg-slate-900 shadow-2xl shadow-indigo-950/50 overflow-hidden"
          role="dialog"
          aria-label="Afet asistanı sohbet"
        >
          <header className="shrink-0 px-4 py-3 bg-indigo-950/80 border-b border-indigo-800/50 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white text-sm">🤖 Afet Asistanı</p>
              <p className="text-[10px] text-indigo-300">Gemini 2.5 Flash</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setShowSettings((s) => !s)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white text-xs"
                title="API ayarları"
              >
                ⚙️
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
          </header>

          {showSettings && (
            <div className="shrink-0 p-3 bg-slate-800/80 border-b border-slate-700 text-xs">
              <p className="text-slate-400 mb-2">
                API anahtarı: <code className="text-indigo-300">.env</code> içinde{' '}
                <code className="text-indigo-300">VITE_GEMINI_API_KEY</code> veya buraya yapıştırın
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-600 text-slate-200"
                />
                <button
                  type="button"
                  onClick={saveApiKey}
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  Kaydet
                </button>
              </div>
              {hasKey && (
                <p className="text-emerald-400 mt-1">✓ Anahtar tanımlı</p>
              )}
            </div>
          )}

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-md'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl bg-slate-800 text-slate-400 text-sm animate-pulse">
                  Yazıyor...
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="shrink-0 px-3 py-1 text-xs text-red-400 border-t border-slate-800">
              {error}
            </p>
          )}

          {!loading && (
            <div className="shrink-0 px-3 pb-2 space-y-1.5 border-t border-slate-800/50 pt-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">
                Öne çıkan sorular
              </p>
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuickQuestion(q)}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-indigo-950/50 hover:text-white border border-slate-700 hover:border-indigo-600/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSend}
            className="shrink-0 p-3 border-t border-slate-800 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sorunuzu yazın..."
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium disabled:opacity-40"
            >
              Gönder
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-[2000] w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50 flex items-center justify-center text-2xl border-2 border-indigo-400/30 transition-transform hover:scale-105"
        aria-label={open ? 'Sohbeti kapat' : 'Afet asistanını aç'}
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}
