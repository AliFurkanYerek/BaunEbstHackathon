import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { db } from '../db.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { analyzeBuildingImage } from '../services/imageAnalysis.js';
import { planEvacuation } from '../services/evacuation.js';

export const analysisRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

analysisRouter.post(
  '/image',
  authRequired,
  adminOnly,
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Görüntü dosyası gerekli' });
    }

    try {
      const { detections, overallScore } = await analyzeBuildingImage(req.file.buffer);
      const id = uuid();
      const { lat, lng, building_id } = req.body;

      db.prepare(
        `INSERT INTO image_analyses (id, filename, lat, lng, detections_json)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        id,
        req.file.originalname,
        lat ? parseFloat(lat) : null,
        lng ? parseFloat(lng) : null,
        JSON.stringify(detections)
      );

      if (building_id) {
        let damageLevel = 'minor';
        if (overallScore > 0.7) damageLevel = 'collapsed';
        else if (overallScore > 0.55) damageLevel = 'severe';
        else if (overallScore > 0.4) damageLevel = 'moderate';

        db.prepare(
          `UPDATE buildings SET damage_level = ?, image_analysis_score = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(damageLevel, overallScore, building_id);
      }

      res.json({
        analysisId: id,
        filename: req.file.originalname,
        detections,
        overallScore,
        suggestedDamageLevel:
          overallScore > 0.7
            ? 'collapsed'
            : overallScore > 0.55
              ? 'severe'
              : overallScore > 0.4
                ? 'moderate'
                : 'minor',
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Görüntü analizi başarısız' });
    }
  }
);

analysisRouter.get('/evacuation', (_req, res) => {
  const plan = planEvacuation();
  res.json(plan);
});

analysisRouter.get('/dashboard', (_req, res) => {
  const buildingCount = (
    db.prepare(`SELECT COUNT(*) as c FROM buildings`).get() as { c: number }
  ).c;
  const zoneCount = (db.prepare(`SELECT COUNT(*) as c FROM safe_zones`).get() as { c: number })
    .c;
  const pendingSos = (
    db.prepare(`SELECT COUNT(*) as c FROM sos_reports WHERE status = 'pending'`).get() as {
      c: number;
    }
  ).c;
  const collapsed = (
    db
      .prepare(`SELECT COUNT(*) as c FROM buildings WHERE damage_level IN ('collapsed','severe')`)
      .get() as { c: number }
  ).c;

  const plan = planEvacuation();
  const totalDeficit = plan.aidEstimates.reduce(
    (acc, z) => ({
      water: acc.water + z.deficit.water,
      food: acc.food + z.deficit.food,
      medical: acc.medical + z.deficit.medical,
      blankets: acc.blankets + z.deficit.blankets,
    }),
    { water: 0, food: 0, medical: 0, blankets: 0 }
  );

  res.json({
    stats: { buildingCount, zoneCount, pendingSos, collapsedBuildings: collapsed },
    evacuation: plan,
    totalAidDeficit: totalDeficit,
  });
});
