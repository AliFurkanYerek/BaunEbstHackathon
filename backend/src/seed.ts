import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { db, initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

initDb();

db.exec(`DELETE FROM sos_reports; DELETE FROM image_analyses; DELETE FROM buildings; DELETE FROM safe_zones; DELETE FROM users;`);

const adminId = uuid();
const citizenId = uuid();

db.prepare(
  `INSERT INTO users (id, username, password_hash, role, name) VALUES (?, ?, ?, 'admin', ?)`
).run(adminId, 'yetkili', bcrypt.hashSync('admin123', 10), 'AFAD Koordinatörü');

db.prepare(
  `INSERT INTO users (id, username, password_hash, role, name) VALUES (?, ?, ?, 'citizen', ?)`
).run(citizenId, 'vatandas', bcrypt.hashSync('vatandas123', 10), 'Ahmet Yılmaz');

// Balıkesir / Burhaniye demo koordinatları
const buildings = [
  { name: 'Merkez Apartman', address: 'Atatürk Cad. No:12', lat: 39.5004, lng: 26.9762, occupants: 48, floors: 5, damage: 'collapsed' },
  { name: 'Yeşil Sitesi A Blok', address: 'Cumhuriyet Mah. 45. Sok.', lat: 39.5021, lng: 26.9788, occupants: 120, floors: 8, damage: 'severe' },
  { name: 'Öğretmen Lojmanları', address: 'İnönü Cad. No:8', lat: 39.4988, lng: 26.9735, occupants: 32, floors: 4, damage: 'moderate' },
  { name: 'Ticaret Merkezi', address: 'Sanayi Mah.', lat: 39.5055, lng: 26.981, occupants: 85, floors: 3, damage: 'minor' },
  { name: 'Eski Konak', address: 'Kale Mah. No:3', lat: 39.4975, lng: 26.9702, occupants: 12, floors: 2, damage: 'intact' },
];

for (const b of buildings) {
  db.prepare(
    `INSERT INTO buildings (id, name, address, lat, lng, estimated_occupants, floors, damage_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuid(), b.name, b.address, b.lat, b.lng, b.occupants, b.floors, b.damage);
}

const zones = [
  { name: 'Stadyum Toplanma Alanı', lat: 39.503, lng: 26.985, capacity: 500, water: 200, food: 150, medical: 20, blankets: 300 },
  { name: 'Lise Bahçesi', lat: 39.499, lng: 26.972, capacity: 300, water: 100, food: 80, medical: 10, blankets: 150 },
  { name: 'Sahil Parkı', lat: 39.496, lng: 26.968, capacity: 200, water: 50, food: 40, medical: 5, blankets: 80 },
];

for (const z of zones) {
  db.prepare(
    `INSERT INTO safe_zones (id, name, lat, lng, capacity, supplies_water, supplies_food, supplies_medical, supplies_blankets)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuid(), z.name, z.lat, z.lng, z.capacity, z.water, z.food, z.medical, z.blankets);
}

console.log('✓ Demo veriler yüklendi');
console.log('  Yetkili: yetkili / admin123');
console.log('  Vatandaş: vatandas / vatandas123');
