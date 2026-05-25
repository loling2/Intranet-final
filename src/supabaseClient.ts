import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AppRole = 'admin' | 'rrhh' | 'employee';

export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  role: AppRole;
  activo: boolean;
  societies: string[];
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  matricula: string;
  marca: string;
  modelo: string;
  kilometros_actuales: number;
  fecha_itv: string;
  estado: 'libre' | 'en_uso';
  society_id: string;
  current_user_id: string | null;
  current_user_nombre: string | null;
  current_km_inicio: number | null;
  current_fecha_inicio: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleLog {
  id: string;
  vehicle_id: string;
  user_id: string;
  user_nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  km_inicio: number;
  km_fin: number | null;
  duracion_minutos: number | null;
  tipo: 'normal' | 'incidencia';
  motivo: string | null;
  liberado_por: string | null;
  liberado_por_nombre: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  nombre_archivo: string;
  tipo: string;
  folder: 'publico' | 'privado';
  usuario_destino_id: string | null;
  usuario_destino_email: string;
  society_id: string;
  fecha_subida: string;
  subido_por: string | null;
  subido_por_nombre: string;
  tamano_bytes: number;
  indexeddb_key: string;
  wasabi_key: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  evento: string;
  descripcion: string;
  autor_id: string | null;
  autor_nombre: string;
  autor_email: string;
  entidad: string;
  entidad_id: string | null;
  metadata: Record<string, unknown>;
  society_id: string | null;
  created_at: string;
}
