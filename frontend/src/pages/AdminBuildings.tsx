import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import type { Building, DamageLevel } from '../types';
import { DAMAGE_LABELS } from '../utils/damage';

const DAMAGE_LEVELS = Object.keys(DAMAGE_LABELS) as DamageLevel[];

const emptyForm = {
  name: '',
  address: '',
  lat: 39.5004,
  lng: 26.9762,
  estimated_occupants: 0,
  floors: 1,
  damage_level: 'unknown' as DamageLevel,
  notes: '',
};

export default function AdminBuildings() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const load = () => api<{ buildings: Building[] }>('/buildings').then((r) => setBuildings(r.buildings));

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/buildings', { method: 'POST', body: JSON.stringify(form) });
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Bu binayı silmek istediğinize emin misiniz?')) return;
    await api(`/buildings/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Bina Veri Girişi</h2>
          <p className="text-slate-400 text-sm">Yetkili personel — adres, nüfus, hasar</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500"
        >
          <Plus className="w-4 h-4" />
          Yeni Bina
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 p-5 rounded-xl bg-slate-900 border border-slate-800 grid gap-4 sm:grid-cols-2">
          <input
            placeholder="Bina adı"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
            required
          />
          <input
            placeholder="Adres"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
            required
          />
          <input
            type="number"
            step="any"
            placeholder="Enlem"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
          />
          <input
            type="number"
            step="any"
            placeholder="Boylam"
            value={form.lng}
            onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
          />
          <input
            type="number"
            placeholder="Tahmini kişi sayısı"
            value={form.estimated_occupants}
            onChange={(e) => setForm({ ...form, estimated_occupants: parseInt(e.target.value) || 0 })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
          />
          <select
            value={form.damage_level}
            onChange={(e) => setForm({ ...form, damage_level: e.target.value as DamageLevel })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
          >
            {DAMAGE_LEVELS.map((l) => (
              <option key={l} value={l}>{DAMAGE_LABELS[l]}</option>
            ))}
          </select>
          <button type="submit" className="sm:col-span-2 py-2 rounded-lg bg-brand-600 font-medium">
            Kaydet
          </button>
        </form>
      )}

      <div className="space-y-2">
        {buildings.map((b) => (
          <div
            key={b.id}
            className="flex justify-between items-center p-4 rounded-xl bg-slate-900 border border-slate-800"
          >
            <div>
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-slate-400">{b.address}</p>
              <p className="text-xs text-slate-500 mt-1">
                ~{b.estimated_occupants} kişi · {DAMAGE_LABELS[b.damage_level]}
              </p>
            </div>
            <button onClick={() => remove(b.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
