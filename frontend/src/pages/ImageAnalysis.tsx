import { useEffect, useState, useRef } from 'react';
import { Upload, Scan } from 'lucide-react';
import { api } from '../api/client';
import type { Building, DamageDetection } from '../types';
import { damageLabel } from '../utils/damage';

export default function ImageAnalysis() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingId, setBuildingId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [detections, setDetections] = useState<DamageDetection[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    api<{ buildings: Building[] }>('/buildings').then((r) => setBuildings(r.buildings));
  }, []);

  const onFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDetections([]);
    setScore(null);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('image', file);
    if (buildingId) fd.append('building_id', buildingId);

    const token = localStorage.getItem('token');
    const res = await fetch('/api/analysis/image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setDetections(data.detections);
    setScore(data.overallScore);
    setSuggested(data.suggestedDamageLevel);
  };

  useEffect(() => {
    if (!preview || !canvasRef.current || detections.length === 0) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      for (const d of detections) {
        const colors: Record<string, string> = {
          minor: '#eab308',
          moderate: '#f97316',
          severe: '#ef4444',
          collapsed: '#7f1d1d',
        };
        ctx.strokeStyle = colors[d.damageLevel] ?? '#fff';
        ctx.lineWidth = 3;
        const x = (d.x / 100) * img.width;
        const y = (d.y / 100) * img.height;
        const w = (d.width / 100) * img.width;
        const h = (d.height / 100) * img.height;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '12px sans-serif';
        ctx.fillText(`${damageLabel(d.damageLevel)} ${(d.confidence * 100).toFixed(0)}%`, x, y - 4);
      }
    };
    img.src = preview;
  }, [preview, detections]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Scan className="w-7 h-7 text-brand-500" />
          Görüntü Analizi
        </h2>
        <p className="text-slate-400 text-sm">
          Uydu veya drone görüntüsünden yıkık bina tespiti (MVP: piksel analizi)
        </p>
      </header>

      <div className="grid gap-6">
        <select
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800"
        >
          <option value="">Bina ile eşleştir (isteğe bağlı)</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <label className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-brand-600 transition-colors">
          <Upload className="w-10 h-10 text-slate-500 mb-3" />
          <span className="text-slate-400">Görüntü yükle (JPG, PNG)</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        {preview && (
          <div className="relative">
            <canvas ref={canvasRef} className="max-w-full rounded-xl border border-slate-800" />
          </div>
        )}

        <button
          onClick={analyze}
          disabled={!file || loading}
          className="py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold disabled:opacity-50"
        >
          {loading ? 'Analiz ediliyor...' : 'Analiz Et'}
        </button>

        {score != null && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <p>Hasar skoru: <strong>{score}</strong></p>
            <p>Önerilen seviye: <strong>{damageLabel(suggested ?? '')}</strong></p>
            <p className="text-sm text-slate-400 mt-1">{detections.length} bölge tespit edildi</p>
          </div>
        )}
      </div>
    </div>
  );
}
