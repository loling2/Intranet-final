import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AppRole = 'admin' | 'rrhh' | 'employee' | 'prevencion';

export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  role: AppRole;
  activo: boolean;
  societies: string[];
  invited_by: string | null;
  pin: string | null;
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
  folder: 'publico' | 'privado' | 'prevencion';
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

export interface Sociedad {
  id: string;
  nombre: string;
  created_at: string;
}

export interface Empleado {
  id: string;
  user_id: string | null;
  id_sociedad: string;
  nombre: string;
  email: string;
  dni: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  tipo_contrato: string | null;
  fecha_alta: string | null;
  fin_periodo_prueba: string | null;
  observaciones_contrato: string | null;
  turno: string | null;
  puesto: string | null;
  centro_trabajo: string | null;
  titulacion_habilitante: string | null;
  fecha_pago_tasas: string | null;
  observaciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Centro {
  id: string;
  nombre: string;
  id_sociedad: string;
  created_at: string;
}

export interface Asignacion {
  id: string;
  id_empleado: string;
  id_centro: string;
  rol: 'Empleado' | 'Supervisor' | 'Admin';
  created_at: string;
}

export interface Tag {
  id: string;
  nombre: string;
  created_at: string;
}

export interface Etiquetado {
  id: string;
  entidad_id: string;
  tag_id: string;
  created_at: string;
}

export interface DocumentoCentro {
  id: string;
  path: string;
  nombre_archivo: string;
  id_centro: string;
  tag_id: string | null;
  fecha_creacion: string;
}
