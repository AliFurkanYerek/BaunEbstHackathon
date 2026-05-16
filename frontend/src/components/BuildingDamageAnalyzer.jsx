import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeImage, checkInferenceBackend } from '../utils/roboflow.js';
import { geolocatePhoto } from '../utils/geoPhoto.js';
import { formatUserMessage } from '../utils/formatUserMessage.js';

export default function BuildingDamageAnalyzer({ onPhotoLocated, onPhotoReportSaved }) {
  const [backendStatus, setBackendStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [geoInfo, setGeoInfo] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
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
    setGeoInfo(null);
    onPhotoLocated?.(null);
    onPhotoReportSaved?.(null);
  };

  const runAnalysis = async () => {
    if (!file) return;
    setLoading(true);
    setGeoLoading(true);
    setError('');
    setGeoInfo(null);
    onPhotoLocated?.(null);
    onPhotoReportSaved?.(null);

    let analysisData = null;

    try {
      try {
        analysisData = await analyzeImage(file);
        setResult(analysisData);
      } catch (e) {
        setError(formatUserMessage(e.message) || 'Analiz başarısız');
        setResult(null);
      }

      try {
        const g = await geolocatePhoto(file);
        if (g.status === 'success' && g.locations?.[0]) {
          const loc = g.locations[0];
          const lat = Number(loc.latitude);
          const lng = Number(loc.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const payload = {
              lat,
              lng,
              address: loc.address || '',
              confidence: loc.confidence != null ? Number(loc.confidence) : undefined,
              reasoning: loc.reasoning || '',
              source: g.source || g.engine || 'geoseeer',
            };
            setGeoInfo({ ok: true, ...payload });
            onPhotoLocated?.(payload);
            if (analysisData) {
              onPhotoReportSaved?.({
                fileName: file.name,
                analysis: analysisData,
                geo: payload,
              });
            }
          } else {
            setGeoInfo({ ok: false, error: 'Konum koordinatları okunamadı' });
          }
        } else {
          setGeoInfo({
            ok: false,
            error:
              formatUserMessage(g.error) ||
              (g.status === 'unavailable'
                ? 'GPS yok ve GEOSEER_API_KEY tanımlı değil (inference-api/.env)'
                : 'Konum tespit edilemedi'),
          });
        }
      } catch (geoErr) {
        setGeoInfo({
          ok: false,
          error: formatUserMessage(geoErr?.message ?? geoErr) || 'Konum servisi hatası',
        });
      }
    } finally {
      setLoading(false);
      setGeoLoading(false);
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
          {loading || geoLoading
            ? geoLoading && !loading
              ? 'Konum bulunuyor (GeoSeer)…'
              : loading && geoLoading
                ? 'Hasar + konum analizi…'
                : 'Roboflow analiz ediyor…'
            : 'Yıkık bina (enkaz) tespit et'}
        </button>

        {geoInfo && (
          <div
            className={`text-sm rounded-lg px-3 py-2 border ${
              geoInfo.ok
                ? 'bg-pink-950/30 border-pink-800/50 text-pink-100'
                : 'bg-amber-950/30 border-amber-800/50 text-amber-100'
            }`}
          >
            {geoInfo.ok ? (
              <>
                <p className="font-medium">📍 Konum haritada gösterildi</p>
                {geoInfo.address && <p className="text-xs mt-1 opacity-90">{geoInfo.address}</p>}
                {geoInfo.confidence != null && (
                  <p className="text-xs mt-1 opacity-80">
                    Güven:{' '}
                    {((geoInfo.confidence <= 1 ? geoInfo.confidence * 100 : geoInfo.confidence) || 0).toFixed(
                      0
                    )}
                    % · {geoInfo.source === 'exif' || geoInfo.source === 'exif_gps' ? 'EXIF GPS' : 'GeoSeer'}
                  </p>
                )}
              </>
            ) : (
              <p>Konum: {geoInfo.error}</p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {result && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Yıkık" value={summaryFrom(result).collapsed} color="text-red-400" />
              <StatCard
                label="Tespit Edilen Hasar Oranı"
                value={`${result.suggestedDamageLevel ?? '-'}/5`}
                color="text-violet-300"
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function summaryFrom(result) {
  const dets = result?.detections ?? [];
  const collapsed = dets.filter((d) => d.type === 'collapsed').length;
  const fromApi = result?.summary;
  return {
    collapsed: fromApi?.collapsed ?? collapsed,
  };
}

function StatCard({ label, value, color }) {
  return (
    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
      <p className="text-[10px] tracking-wide text-slate-500 leading-tight">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
