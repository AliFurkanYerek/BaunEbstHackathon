import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db.js';
import { authRequired, adminOnly } from '../middleware/auth.js';

export const zonesRouter = Router();

zonesRouter.get('/', (_req, res) => {
  const zones = db.prepare(`SELECT * FROM safe_zones ORDER BY name`).all();
  res.json({ zones });
});

zonesRouter.post('/', authRequired, adminOnly, (req, res) => {
  const {
    name,
    lat,
    lng,
    capacity,
    supplies_water,
    supplies_food,
    supplies_medical,
    supplies_blankets,
    notes,
  } = req.body;

  if (!name || lat == null || lng == null || !capacity) {
    return res.status(400).json({ error: 'Ad, konum ve kapasite zorunlu' });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO safe_zones (id, name, lat, lng, capacity, supplies_water, supplies_food, supplies_medical, supplies_blankets, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    lat,
    lng,
    capacity,
    supplies_water ?? 0,
    supplies_food ?? 0,
    supplies_medical ?? 0,
    supplies_blankets ?? 0,
    notes ?? null
  );

  const zone = db.prepare(`SELECT * FROM safe_zones WHERE id = ?`).get(id);
  res.status(201).json({ zone });
});

zonesRouter.put('/:id', authRequired, adminOnly, (req, res) => {
  const existing = db.prepare(`SELECT id FROM safe_zones WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Güvenli bölge bulunamadı' });

  const allowed = [
    'name',
    'lat',
    'lng',
    'capacity',
    'supplies_water',
    'supplies_food',
    'supplies_medical',
    'supplies_blankets',
    'notes',
  ];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'Güncellenecek alan yok' });
  }
  values.push(req.params.id);
  db.prepare(`UPDATE safe_zones SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const zone = db.prepare(`SELECT * FROM safe_zones WHERE id = ?`).get(req.params.id);
  res.json({ zone });
});

zonesRouter.delete('/:id', authRequired, adminOnly, (req, res) => {
  const result = db.prepare(`DELETE FROM safe_zones WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Güvenli bölge bulunamadı' });
  res.json({ ok: true });
});
