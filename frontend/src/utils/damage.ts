import type { DamageLevel } from '../types';

export const DAMAGE_LABELS: Record<DamageLevel, string> = {
  unknown: 'Bilinmiyor',
  intact: 'Sağlam',
  minor: 'Hafif hasar',
  moderate: 'Orta hasar',
  severe: 'Ağır hasar',
  collapsed: 'Yıkılmış',
};

export const DAMAGE_COLORS: Record<DamageLevel, string> = {
  unknown: '#94a3b8',
  intact: '#22c55e',
  minor: '#eab308',
  moderate: '#f97316',
  severe: '#ef4444',
  collapsed: '#7f1d1d',
};

export function damageLabel(level: string): string {
  return DAMAGE_LABELS[level as DamageLevel] ?? level;
}

export function damageColor(level: string): string {
  return DAMAGE_COLORS[level as DamageLevel] ?? '#94a3b8';
}
