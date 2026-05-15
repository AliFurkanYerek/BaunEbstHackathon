import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { db } from '../db.js';
import { signToken, authRequired } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  }

  const user = db
    .prepare(`SELECT * FROM users WHERE username = ?`)
    .get(username) as
    | {
        id: string;
        username: string;
        password_hash: string;
        role: 'admin' | 'citizen';
        name: string;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    username: user.username,
  });

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name },
  });
});

authRouter.get('/me', authRequired, (req, res) => {
  const user = db.prepare(`SELECT id, username, role, name FROM users WHERE id = ?`).get(
    req.user!.userId
  );
  res.json({ user });
});

authRouter.post('/register-citizen', (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }
  const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (existing) return res.status(409).json({ error: 'Kullanıcı adı kullanımda' });

  const id = uuid();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, name) VALUES (?, ?, ?, 'citizen', ?)`
  ).run(id, username, bcrypt.hashSync(password, 10), name);

  const token = signToken({ userId: id, role: 'citizen', username });
  res.status(201).json({
    token,
    user: { id, username, role: 'citizen', name },
  });
});
