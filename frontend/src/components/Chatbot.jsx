import { useState, useRef, useEffect } from 'react';
import {
  sendGeminiMessage,
  getGeminiApiKey,
  setGeminiApiKey,
} from '../utils/gemini.js';
import { formatUserMessage } from '../utils/formatUserMessage.js';
import { wantsRouteToSafeZone, wantsRouteToHospital } from '../utils/routeIntent.js';
import { speakTurkish, stopSpeaking, isTtsSupported } from '../utils/tts.js';

function SpeakButton({ text, speaking, onSpeak }) {
  if (!isTtsSupported()) return null;
  return (
    <button
      type="button"
      onClick={() => onSpeak(text)}
      className={`shrink-0 p-2 rounded-lg transition-colors ${
        speaking
          ? 'bg-amber-600/40 text-amber-200'
          : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 hover:text-white'
      }`}
      title={speaking ? 'Sesi durdur' : 'Mesajı sesli oku'}
      aria-label={speaking ? 'Sesi durdur' : 'Sesli oku'}
    >
      <span className="text-lg" aria-hidden>
        {speaking ? '⏹' : '🔊'}
      </span>
    </button>
  );
}

const WELCOME =
  'Merhaba! Ben afet asistanınızım. Haritada konumunuzu seçerseniz en yakın güvenli alanı veya hastaneyi söyleyebilir, haritada yürüyüş rotasını çizebilirim. Aşağıdaki öne çıkan sorulardan birine tıklayabilir veya kendi sorunuzu yazabilirsiniz.';

export default function Chatbot({
  safeZones,
  zonesByCity,
  hospitals = [],
  selectedCoords,
  nearestInfo,
  nearestHospital,
  onShowRouteToNearest,
  onShowRouteToNearestHospital,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', text: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [speakingKey, setSpeakingKey] = useState(null);
  const listRef = useRef(null);

  const handleSpeak = (key, text) => {
    if (speakingKey === key) {
      stopSpeaking();
      setSpeakingKey(null);
      return;
    }
    stopSpeaking();
    setSpeakingKey(key);
    speakTurkish(text, {
      onEnd: () => setSpeakingKey(null),
    });
  };

  useEffect(() => () => stopSpeaking(), []);

  const hasKey = Boolean(getGeminiApiKey() || import.meta.env.VITE_GEMINI_API_KEY);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const context = {
    safeZones,
    zonesByCity,
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
    hospitalsWithDistance: selectedCoords
      ? hospitals
          .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng))
          .map((h) => {
            const R = 6371;
            const dLat = ((h.lat - selectedCoords.lat) * Math.PI) / 180;
            const dLng = ((h.lng - selectedCoords.lng) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos((selectedCoords.lat * Math.PI) / 180) *
                Math.cos((h.lat * Math.PI) / 180) *
                Math.sin(dLng / 2) ** 2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return {
              name: h.name,
              lat: h.lat,
              lng: h.lng,
              il: h.il,
              distanceKm: Math.round(dist * 100) / 100,
            };
          })
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 15)
      : [],
    nearestHospital,
  };

  const appendRouteHint = async (questionText, reply) => {
    if (wantsRouteToHospital(questionText) && onShowRouteToNearestHospital) {
      const routeResult = await onShowRouteToNearestHospital();
      if (!routeResult?.ok) {
        return `${reply}\n\n🏥 ${routeResult?.error || 'Hastane rotası gösterilemedi.'}`;
      }
      const extra = routeResult.isEstimate
        ? ' (sokak rotası alınamadı, düz çizgi)'
        : '';
      return `${reply}\n\n🏥 Haritada ${routeResult.hospitalName} için yürüyüş rotası çizildi${extra}: ${routeResult.summary}.`;
    }
    if (!wantsRouteToSafeZone(questionText) || !onShowRouteToNearest) return reply;
    const routeResult = await onShowRouteToNearest();
    if (!routeResult?.ok) {
      return `${reply}\n\n🗺️ ${routeResult?.error || 'Rota gösterilemedi.'}`;
    }
    const extra = routeResult.isEstimate
      ? ' (sokak rotası alınamadı, düz çizgi)'
      : '';
    return `${reply}\n\n🗺️ Haritada ${routeResult.zoneName} için yürüyüş rotası çizildi${extra}: ${routeResult.summary}.`;
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
      let reply = await sendGeminiMessage(history, context);
      reply = await appendRouteHint(text, reply);
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setError(formatUserMessage(err?.message ?? err) || 'Bir hata oluştu');
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
    'En yakın hastaneye nasıl giderim?',
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
      let reply = await sendGeminiMessage(history, context);
      reply = await appendRouteHint(question, reply);
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setError(formatUserMessage(err?.message ?? err) || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed bottom-32 right-4 z-[2000] w-[min(100vw-2rem,420px)] h-[min(75vh,560px)] flex flex-col rounded-2xl border border-amber-800/40 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden"
          role="dialog"
          aria-label="Afet asistanı sohbet"
        >
          <header className="shrink-0 px-4 py-3 bg-amber-950/50 border-b border-amber-900/40 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white text-lg">🤖 Afet Asistanı</p>
              <p className="text-sm text-amber-200/70">Sesli okuma · Türkçe</p>
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
            {messages.map((m, i) => {
              const key = `msg-${i}`;
              return (
                <div
                  key={key}
                  className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'model' && (
                    <SpeakButton
                      text={m.text}
                      speaking={speakingKey === key}
                      onSpeak={() => handleSpeak(key, m.text)}
                    />
                  )}
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-base leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-sky-700 text-white rounded-br-md'
                        : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-md'
                    }`}
                  >
                    {formatUserMessage(m.text)}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-400 text-base animate-pulse">
                  Yazıyor...
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="shrink-0 px-3 py-1 text-xs text-red-400 border-t border-slate-800">
              {formatUserMessage(error)}
            </p>
          )}

          {!loading && (
            <div className="shrink-0 px-3 pb-2 space-y-1.5 border-t border-slate-800/50 pt-2">
              <p className="text-sm text-slate-500 uppercase tracking-wide font-medium">
                Öne çıkan sorular
              </p>
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuickQuestion(q)}
                  className="w-full text-left text-base px-4 py-3 rounded-lg bg-slate-800/80 text-slate-200 hover:bg-amber-950/40 hover:text-white border border-slate-700 hover:border-amber-700/50 transition-colors"
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
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-base font-semibold disabled:opacity-40"
            >
              Gönder
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-[2000] w-28 h-28 rounded-full bg-amber-600 hover:bg-amber-500 text-white shadow-xl shadow-black/40 flex items-center justify-center text-5xl border-2 border-amber-400/40 transition-transform hover:scale-105"
        aria-label={open ? 'Sohbeti kapat' : 'Afet asistanını aç'}
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}
