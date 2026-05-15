import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { buildingsRouter } from './routes/buildings.js';
import { zonesRouter } from './routes/zones.js';
import { sosRouter } from './routes/sos.js';
import { analysisRouter } from './routes/analysis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

initDb();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'ResilienceHub API' });
});

app.use('/api/auth', authRouter);
app.use('/api/buildings', buildingsRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/sos', sosRouter);
app.use('/api/analysis', analysisRouter);

app.listen(PORT, () => {
  console.log(`ResilienceHub API → http://localhost:${PORT}`);
});
