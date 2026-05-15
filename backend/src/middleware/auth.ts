import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'resilience-hub-dev-secret';

export interface AuthPayload {
  userId: string;
  role: 'admin' | 'citizen';
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için yetkili hesabı gerekli' });
  }
  next();
}
