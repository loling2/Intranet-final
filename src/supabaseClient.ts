import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AppRole =
  | 'admin'
  | 'rrhh'
  | 'supervisor'
  | 'prevencion'
  | 'empleado'
  | 'encargado'
  | 'administracion'
  | 'employee'
  | string;

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
  estado: 'libre' | 'en_uso' | 'bloqueado';
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
  user_id: string | null;
  user_nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  km_inicio: number | null;
  km_fin: number | null;
  duracion_minutos: number | null;
  tipo: 'normal' | 'incidencia';
  nota: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  nombre_archivo: string;
  tipo: string;
  tamano_bytes: number | null;
  fecha_subida: string;
  wasabi_key: string | null;
  indexeddb_key: string | null;
  society_id: string | null;
  folder: string | null;
  uploaded_by: string | null;
  subido_por_nombre: string | null;
  usuario_destino_email: string | null;
  created_at: string;
}

export interface Empleado {
  id: string;
  user_id: string | null;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  dni: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  id_sociedad: string | null;
  id_sociedad_secundaria: string | null;
  tipo_contrato: string | null;
  fecha_alta: string | null;
  fin_periodo_prueba: string | null;
  observaciones_contrato: string | null;
  turno: string | null;
  puesto: string | null;
  centro_trabajo: string | null;
  titulacion_habilitante: string | null;
  fecha_pago_tasas: string | null;
  nass: string | null;
  sexo: string | null;
  convenio: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  observaciones: string | null;
  activo: boolean;
  estado_contrato: EstadoContrato | null;
  reconocimiento_medico: string | null;
  reconocimiento_medico_estado: string | null;
  reconocimiento_medico_fecha: string | null;
  reconocimiento_medico_realizado: boolean | null;
  entrega_doc_prl: string | null;
  entrega_doc_prl_observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export type EstadoContrato = 'pendiente' | 'avisado' | 'firmado';

export interface HistorialContrato {
  id: string;
  empleado_id: string;
  estado: EstadoContrato;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  justificacion: string | null;
  cambiado_por: string | null;
  cambiado_por_nombre: string | null;
  fecha: string;
  observaciones: string | null;
  created_at: string;
}

export interface Sociedad {
  id: string;
  nombre: string;
  created_at?: string;
}

export interface Centro {
  id: string;
  nombre: string;
  id_sociedad: string;
}

export interface Asignacion {
  id: string;
  examen_id: string;
  empleado_id: string | null;
  nombre_empleado: string;
  dni: string | null;
  estado: string;
  puntuacion: number | null;
  fecha_realizacion: string | null;
  id_centro: string | null;
  rol: string | null;
  centro_nombre?: string;
}

export interface Tag {
  id: string;
  nombre: string;
  society_id: string | null;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  evento: string;
  descripcion: string;
  autor_id: string | null;
  autor_nombre: string | null;
  autor_email: string;
  entidad: string | null;
  entidad_id: string | null;
  metadata: Record<string, unknown> | null;
  society_id: string | null;
  created_at: string;
}

export interface Dispositivo {
  id: string;
  tipo: string;
  marca_modelo: string;
  caracteristicas: string;
  centro_trabajo: string;
  numero_serie: string;
  estado_id: 1 | 2 | 3;
  etiquetado: string | null;
  valor_estimado: number | null;
  numero_telefono: string | null;
  society_id: string;
  empleado_id: string | null;
  usuario_asignado_nombre: string;
  fecha_asignacion: string | null;
  notas: string;
  created_at: string;
  updated_at: string;
}

export interface WorkLog {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  break_time: number;
  log_date: string;
  is_extra: boolean;
  metadata: Record<string, unknown> | null;
  modified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeIncident {
  id: string;
  user_id: string;
  work_log_id: string | null;
  reason: string;
  proposed_start: string | null;
  proposed_end: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}
