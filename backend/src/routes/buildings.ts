import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db.js';
import { authRequired, adminOnly } from '../middleware/auth.js';

export const buildingsRouter = Router();

buildingsRouter.get('/', (_req, res) => {
  const buildings = db.prepare(`SELECT * FROM buildings ORDER BY name`).all();
  res.json({ buildings });
});

buildingsRouter.get('/:id', (req, res) => {
  const building = db.prepare(`SELECT * FROM buildings WHERE id = ?`).get(req.params.id);
  if (!building) return res.status(404).json({ error: 'Bina bulunamadı' });
  res.json({ building });
});

buildingsRouter.post('/', authRequired, adminOnly, (req, res) => {
  const {
    name,
    address,
    lat,
    lng,
    estimated_occupants,
    floors,
    damage_level,
    notes,
  } = req.body;

  if (!name || !address || lat == null || lng == null) {
    return res.status(400).json({ error: 'Ad, adres ve konum zorunlu' });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO buildings (id, name, address, lat, lng, estimated_occupants, floors, damage_level, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    address,
    lat,
    lng,
    estimated_occupants ?? 0,
    floors ?? 1,
    damage_level ?? 'unknown',
    notes ?? null
  );

  const building = db.prepare(`SELECT * FROM buildings WHERE id = ?`).get(id);
  res.status(201).json({ building });
});

buildingsRouter.put('/:id', authRequired, adminOnly, (req, res) => {
  const existing = db.prepare(`SELECT id FROM buildings WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bina bulunamadı' });

  const fields = [
    'name',
    'address',
    'lat',
    'lng',
    'estimated_occupants',
    'floors',
    'damage_level',
    'notes',
    'image_analysis_score',
  ] as const;

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'Güncellenecek alan yok' });
  }
  updates.push(`updated_at = datetime('now')`);
  values.push(req.params.id);

  db.prepare(`UPDATE buildings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const building = db.prepare(`SELECT * FROM buildings WHERE id = ?`).get(req.params.id);
  res.json({ building });
});

buildingsRouter.delete('/:id', authRequired, adminOnly, (req, res) => {
  const result = db.prepare(`DELETE FROM buildings WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Bina bulunamadı' });
  res.json({ ok: true });
});
