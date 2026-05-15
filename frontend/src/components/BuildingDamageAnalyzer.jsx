import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeImage, checkInferenceBackend, getDatasetUrls } from '../utils/roboflow.js';

export default function BuildingDamageAnalyzer() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const refreshBackend = useCallback(async () => {
    try {
      const status = await checkInferenceBackend();
      setBackendStatus(status);
    } catch {
      setBackendStatus({
        ok: false,
        message:
          'Analiz sunucusu kapalı. Terminalde: cd inference-api && pip install -r requirements.txt && python app.py',
      });
    }
  }, []);

  useEffect(() => {
    refreshBackend();
  }, [refreshBackend]);

  const onFile = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError('');
  };

  const runAnalysis = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const data = await analyzeImage(file);
      setResult(data);
    } catch (e) {
      setError(e.message || 'Analiz başarısız');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!preview || !result?.detections?.length || !canvasRef.current || !imgRef.current) return;

    const img = imgRef.current;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      for (const d of result.detections) {
        const { x: bx, y: by, width: bw, height: bh } = d.pixelBox;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = Math.max(2, img.naturalWidth / 400);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = d.color;
        ctx.font = `${Math.max(12, img.naturalWidth / 50)}px sans-serif`;
        ctx.fillText(`${d.label} ${(d.confidence * 100).toFixed(0)}%`, bx, Math.max(14, by - 4));
      }
    };

    if (img.complete) draw();
    else img.onload = draw;
  }, [preview, result]);

  const backendOk = backendStatus?.ok === true;

  return (
    <section className="rounded-xl border border-violet-900/50 bg-slate-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 bg-violet-950/30">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span aria-hidden>🔬</span> Yapay Zeka — Bina Hasar Tespiti
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          İki Roboflow modeli birleştirilir (IoU ile çift kutular elenir):{' '}
          {getDatasetUrls().map(([label, href], i) => (
            <span key={href}>
              {i > 0 ? ' · ' : ''}
              <a href={href} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">
                {label}
              </a>
            </span>
          ))}{' '}
          · sınıf: <strong className="text-slate-300">collapsed</strong>
        </p>
      </div>

      <div className="p-4 space-y-4">
        {backendStatus && (
          <div
            className={`text-xs px-3 py-2 rounded-lg border ${
              backendOk
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : 'bg-amber-950/40 border-amber-800 text-amber-100'
            }`}
          >
            {backendStatus.message}
            {!backendOk && (
              <p className="mt-2 text-amber-200/80 font-mono text-[10px] leading-relaxed">
                {backendStatus.serverUp ? (
                  <>
                    inference-api\.env → ROBOFLOW_API_KEY=anahtariniz
                    <br />
                    python app.py (yeniden baslatin)
                  </>
                ) : (
                  <>
                    Terminal 1: npm run api
                    <br />
                    Terminal 2: npm run dev
                    <br />
                    .env: ROBOFLOW_API_KEY doldurun
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={refreshBackend}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Sunucu durumunu yenile
        </button>

        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-violet-800/60 rounded-xl cursor-pointer hover:border-violet-600/80 transition-colors">
          <span className="text-3xl mb-2" aria-hidden>📷</span>
          <span className="text-sm text-slate-400">Deprem fotoğrafı yükle (JPG, PNG)</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        {preview && (
          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black/40">
            <img ref={imgRef} src={preview} alt="Analiz" className="sr-only" />
            {result?.detections?.length ? (
              <canvas ref={canvasRef} className="max-w-full h-auto mx-auto block" />
            ) : (
              <img src={preview} alt="Önizleme" className="max-w-full h-auto mx-auto block" />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={runAnalysis}
          disabled={!file || loading || !backendOk}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Roboflow analiz ediyor…' : 'Yıkık bina (enkaz) tespit et'}
        </button>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {result && (
          <>
            {result.message && (
              <p className="text-xs text-violet-200/90 bg-violet-950/40 border border-violet-800/50 rounded-lg px-3 py-2">
                {result.message}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Sağlam" value={summaryFrom(result).intact} color="text-emerald-400" />
              <StatCard label="Yıkık" value={summaryFrom(result).collapsed} color="text-red-400" />
              <StatCard label="Toplam kutu" value={summaryFrom(result).total} color="text-slate-300" />
              <StatCard
                label="Önerilen hasar"
                value={`${result.suggestedDamageLevel ?? '-'}/5`}
                color="text-violet-300"
              />
            </div>
            {result.detections?.length > 0 && (
              <ul className="text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                {result.detections.map((d) => (
                  <li key={d.id}>
                    <span style={{ color: d.color }}>
                      {d.label} — {(d.confidence * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function summaryFrom(result) {
  const dets = result?.detections ?? [];
  const intact = dets.filter((d) => d.type === 'intact').length;
  const collapsed = dets.filter((d) => d.type === 'collapsed').length;
  const fromApi = result?.summary;
  return {
    intact: fromApi?.intact ?? intact,
    collapsed: fromApi?.collapsed ?? collapsed,
    total: fromApi?.total ?? dets.length,
  };
}

function StatCard({ label, value, color }) {
  return (
    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
