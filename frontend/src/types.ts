export type UserRole = 'admin' | 'citizen';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

export type DamageLevel =
  | 'unknown'
  | 'intact'
  | 'minor'
  | 'moderate'
  | 'severe'
  | 'collapsed';

export interface Building {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  estimated_occupants: number;
  floors: number;
  damage_level: DamageLevel;
  notes?: string;
  image_analysis_score?: number;
}

export interface SafeZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  supplies_water: number;
  supplies_food: number;
  supplies_medical: number;
  supplies_blankets: number;
  notes?: string;
}

export interface SosReport {
  id: string;
  lat: number;
  lng: number;
  command_type: string;
  description?: string;
  priority_score: number;
  status: string;
  ai_reasoning?: string;
  user_name?: string;
  created_at: string;
}

export interface DamageDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  damageLevel: string;
}
