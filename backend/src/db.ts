import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'resilience.db');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'citizen')),
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      estimated_occupants INTEGER DEFAULT 0,
      floors INTEGER DEFAULT 1,
      damage_level TEXT DEFAULT 'unknown'
        CHECK(damage_level IN ('unknown','intact','minor','moderate','severe','collapsed')),
      notes TEXT,
      image_analysis_score REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS safe_zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      capacity INTEGER NOT NULL,
      supplies_water INTEGER DEFAULT 0,
      supplies_food INTEGER DEFAULT 0,
      supplies_medical INTEGER DEFAULT 0,
      supplies_blankets INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sos_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      command_type TEXT NOT NULL,
      description TEXT,
      priority_score REAL DEFAULT 0,
      status TEXT DEFAULT 'pending'
        CHECK(status IN ('pending','dispatched','resolved')),
      ai_reasoning TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS image_analyses (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      lat REAL,
      lng REAL,
      detections_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
