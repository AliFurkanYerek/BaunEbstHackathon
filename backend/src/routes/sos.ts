import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import {
  calculateRescuePriority,
  SosCommand,
} from '../services/aiPriority.js';

export const sosRouter = Router();

const VALID_COMMANDS: SosCommand[] = [
  'trapped',
  'injured',
  'fire',
  'gas_leak',
  'child_missing',
  'elderly_trapped',
  'multiple_casualties',
];

sosRouter.get('/commands', (_req, res) => {
  res.json({
    commands: [
      { id: 'trapped', label: 'Enkaz altındayım', icon: '🏚️' },
      { id: 'injured', label: 'Yaralı var', icon: '🩹' },
      { id: 'multiple_casualties', label: 'Çoklu yaralı', icon: '⚠️' },
      { id: 'elderly_trapped', label: 'Yaşlı mahsur', icon: '👴' },
      { id: 'child_missing', label: 'Kayıp çocuk', icon: '👶' },
      { id: 'fire', label: 'Yangın', icon: '🔥' },
      { id: 'gas_leak', label: 'Gaz kaçağı', icon: '💨' },
    ],
  });
});

sosRouter.post('/', authRequired, (req, res) => {
  const { command_type, lat, lng, description } = req.body;

  if (!VALID_COMMANDS.includes(command_type)) {
    return res.status(400).json({ error: 'Geçersiz acil komut tipi' });
  }
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'Konum gerekli' });
  }

  const priority = calculateRescuePriority(command_type, lat, lng);
  const id = uuid();

  db.prepare(
    `INSERT INTO sos_reports (id, user_id, lat, lng, command_type, description, priority_score, ai_reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user!.userId,
    lat,
    lng,
    command_type,
    description ?? null,
    priority.priorityScore,
    priority.reasoning
  );

  const report = db.prepare(`SELECT * FROM sos_reports WHERE id = ?`).get(id);
  res.status(201).json({ report, priority });
});

sosRouter.get('/', authRequired, adminOnly, (_req, res) => {
  const reports = db
    .prepare(
      `SELECT s.*, u.name as user_name, u.username
       FROM sos_reports s
       LEFT JOIN users u ON s.user_id = u.id
       ORDER BY priority_score DESC, created_at DESC`
    )
    .all();
  res.json({ reports });
});

sosRouter.patch('/:id/status', authRequired, adminOnly, (req, res) => {
  const { status } = req.body;
  if (!['pending', 'dispatched', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Geçersiz durum' });
  }
  const result = db
    .prepare(`UPDATE sos_reports SET status = ? WHERE id = ?`)
    .run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  const report = db.prepare(`SELECT * FROM sos_reports WHERE id = ?`).get(req.params.id);
  res.json({ report });
});

sosRouter.get('/priority-queue', authRequired, adminOnly, (_req, res) => {
  const reports = db
    .prepare(
      `SELECT s.*, u.name as user_name
       FROM sos_reports s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE status = 'pending'
       ORDER BY priority_score DESC`
    )
    .all();

  const enriched = (reports as Array<{ command_type: SosCommand; lat: number; lng: number }>).map(
    (r) => ({
      ...r,
      priority: calculateRescuePriority(r.command_type, r.lat, r.lng),
    })
  );

  res.json({ queue: enriched });
});
