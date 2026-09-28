/*
# CRM Extended Modules — Complete Social-Healthcare Platform

## Purpose
Adds all missing CRM modules required for comprehensive residential and
social-healthcare resource management: daily tracking, family communication,
medication management, activities/workshops, ABVD tracking, health incidents,
professional guidelines with history, PAI/PIE plans, professional sessions,
statistics, and meeting minutes.

## New Tables (12 tables)

### 1. crm_seguimiento_diario
Daily tracking and interventions per resident.
- id (uuid PK)
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE)
- fecha (date NOT NULL)
- turno (text: 'mañana'|'tarde'|'noche', default 'mañana')
- descripcion (text NOT NULL)
- intervenciones (text default '')
- autor_id (uuid nullable)
- autor_nombre (text NOT NULL default '')
- created_at, updated_at (timestamptz)

### 2. crm_llamadas_visitas
Log of phone calls, family visits, and family meetings.
- id (uuid PK)
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE)
- tipo (text NOT NULL: 'llamada'|'visita'|'reunion_familia')
- fecha (timestamptz NOT NULL default now())
- interlocutor_nombre (text default '')
- parentesco (text default '')
- motivo (text default '')
- observaciones (text default '')
- autor_id (uuid nullable)
- autor_nombre (text default '')
- created_at, updated_at

### 3. crm_medicacion
Proper medication management with schedule and administration tracking.
- id (uuid PK)
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE)
- nombre_medicamento (text NOT NULL)
- dosis (text default '')
- via (text default 'oral': 'oral'|'topica'|'intravenosa'|'intramuscular'|'subcutanea'|'otra')
- frecuencia (text default '')
- hora_inicio (text default '')
- fecha_inicio (date nullable)
- fecha_fin (date nullable)
- prescriptor (text default '')
- observaciones (text default '')
- activo (boolean default true)
- created_at, updated_at

### 4. crm_medicacion_administracion
Tracks each medication administration event.
- id (uuid PK)
- medicacion_id (uuid FK → crm_medicacion CASCADE)
- fecha_hora (timestamptz NOT NULL default now())
- administrada (boolean NOT NULL default true)
- motivo_no_admin (text default '')
- administrado_por_nombre (text default '')
- observaciones (text default '')
- created_at

### 5. crm_actividades
Activities and workshops.
- id (uuid PK)
- centro_id (uuid FK → centros SET NULL, nullable)
- titulo (text NOT NULL)
- descripcion (text default '')
- tipo (text default 'taller': 'taller'|'actividad'|'ocio'|'terapia'|'formacion'|'otra')
- fecha (date NOT NULL)
- hora_inicio (text default '')
- hora_fin (text default '')
- responsable_nombre (text default '')
- created_at, updated_at

### 6. crm_actividad_participantes
Residents participating in each activity.
- id (uuid PK)
- actividad_id (uuid FK → crm_actividades CASCADE)
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE)
- observaciones (text default '')
- created_at
- UNIQUE (actividad_id, usuario_servicio_id)

### 7. crm_abvd
Basic activities of daily living tracking per resident per date.
- id (uuid PK)
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE)
- fecha (date NOT NULL)
- alimentacion (text default 'normal': 'normal'|'asistida'|'rechaza'|'no_procede')
- higiene (text default 'normal': 'normal'|'asistida'|'rechaza'|'no_procede')
- vestido (text default 'normal': 'normal'|'asistida'|'rechaza'|'no_procede')
- movilidad (text default 'normal': 'normal'|'asistida'|'inmovil'|'no_procede')
- esfinteres (text default 'normal': 'normal'|'incontinencia'|'sonda'|'no_procede')
- sueno (text default 'normal': 'normal'|'alterado'|'insomnio'|'no_procede')
- observaciones (text default '')
- autor_nombre (text default '')
- created_at, updated_at

### 8. crm_incidencias_sanitarias
Health and urgency incidents (falls, ambulance, medication issues, emergencies).
- id (uuid PK)
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE)
- centro_id (uuid FK → centros SET NULL, nullable)
- tipo (text NOT NULL: 'caida'|'ambulancia'|'medicacion'|'emergencia'|'otra')
- fecha_hora (timestamptz NOT NULL default now())
- descripcion (text NOT NULL)
- gravedad (text default 'leve': 'leve'|'moderada'|'grave')
- accion_realizada (text default '')
- requiere_traslado (boolean default false)
- notificada_familia (boolean default false)
- estado (text default 'abierta': 'abierta'|'cerrada')
- fecha_cierre (timestamptz nullable)
- autor_nombre (text default '')
- created_at, updated_at

### 9. crm_pautas
Professional guidelines/indications with history tracking.
- id (uuid PK)
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE)
- tipo_profesional (text NOT NULL: 'psicologia'|'trabajo_social'|'enfermeria'|'terapia_ocupacional'|'logopedia'|'medicina'|'psiquiatria'|'educacion_social'|'integracion_social'|'coordinacion'|'otra')
- pauta (text NOT NULL)
- fecha_inicio (date NOT NULL default CURRENT_DATE)
- fecha_fin (date nullable)
- activa (boolean default true)
- autor_id (uuid nullable)
- autor_nombre (text default '')
- created_at, updated_at

### 10. crm_pai
Individualized Attention Plans (PAI/PIE).
- id (uuid PK)
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE)
- tipo (text NOT NULL default 'PAI': 'PAI'|'PIE')
- version (integer NOT NULL default 1)
- fecha_creacion (date NOT NULL default CURRENT_DATE)
- fecha_revision (date nullable)
- fecha_cierre (date nullable)
- objetivos (text default '')
- areas_intervencion (text default '')
- profesionales_involucrados (text default '')
- evaluacion (text default '')
- estado (text default 'borrador': 'borrador'|'activo'|'revisado'|'cerrado')
- creado_por_nombre (text default '')
- created_at, updated_at

### 11. crm_sesiones
Professional sessions (individual and group).
- id (uuid PK)
- tipo (text NOT NULL: 'individual'|'grupal')
- usuario_servicio_id (uuid FK → usuarios_servicios CASCADE, nullable for group sessions)
- actividad_id (uuid FK → crm_actividades SET NULL, nullable)
- centro_id (uuid FK → centros SET NULL, nullable)
- tipo_profesional (text NOT NULL)
- fecha (date NOT NULL)
- hora_inicio (text default '')
- hora_fin (text default '')
- descripcion (text NOT NULL)
- objetivos (text default '')
- resultados (text default '')
- participante_nombre (text default '')
- autor_id (uuid nullable)
- autor_nombre (text default '')
- created_at, updated_at

### 12. crm_actas
Meeting minutes and records.
- id (uuid PK)
- centro_id (uuid FK → centros SET NULL, nullable)
- titulo (text NOT NULL)
- tipo (text default 'reunion': 'reunion'|'coordinacion'|'equipo'|'supervision'|'otra')
- fecha (date NOT NULL)
- participantes (text default '')
- contenido (text NOT NULL)
- acuerdos (text default '')
- autor_id (uuid nullable)
- autor_nombre (text default '')
- created_at, updated_at

## Security
- RLS enabled on all 12 new tables.
- All policies scoped to authenticated users (the app has sign-in).
- SELECT: all authenticated users can read CRM data (they're healthcare professionals who need to see resident info).
- INSERT: all authenticated users can create records (they're logging their professional work).
- UPDATE: all authenticated users can update records (collaborative care).
- DELETE: only admins (user_profiles role = 'admin' or 'rrhh') can delete records.
- This follows the existing CRM pattern where all professionals need to read/write care data.
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SEGUIMIENTO DIARIO
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_seguimiento_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  turno text NOT NULL DEFAULT 'mañana',
  descripcion text NOT NULL,
  intervenciones text DEFAULT '',
  autor_id uuid,
  autor_nombre text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_seguimiento_diario ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_seguimiento_diario_residente ON crm_seguimiento_diario(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_seguimiento_diario_fecha ON crm_seguimiento_diario(fecha DESC);

DROP POLICY IF EXISTS "crm_seg_diag_select" ON crm_seguimiento_diario;
CREATE POLICY "crm_seg_diag_select" ON crm_seguimiento_diario FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_seg_diag_insert" ON crm_seguimiento_diario;
CREATE POLICY "crm_seg_diag_insert" ON crm_seguimiento_diario FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_seg_diag_update" ON crm_seguimiento_diario;
CREATE POLICY "crm_seg_diag_update" ON crm_seguimiento_diario FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_seg_diag_delete" ON crm_seguimiento_diario;
CREATE POLICY "crm_seg_diag_delete" ON crm_seguimiento_diario FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LLAMADAS Y VISITAS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_llamadas_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  interlocutor_nombre text DEFAULT '',
  parentesco text DEFAULT '',
  motivo text DEFAULT '',
  observaciones text DEFAULT '',
  autor_id uuid,
  autor_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_llamadas_visitas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_llamadas_visitas_residente ON crm_llamadas_visitas(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_llamadas_visitas_fecha ON crm_llamadas_visitas(fecha DESC);

DROP POLICY IF EXISTS "crm_llam_select" ON crm_llamadas_visitas;
CREATE POLICY "crm_llam_select" ON crm_llamadas_visitas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_llam_insert" ON crm_llamadas_visitas;
CREATE POLICY "crm_llam_insert" ON crm_llamadas_visitas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_llam_update" ON crm_llamadas_visitas;
CREATE POLICY "crm_llam_update" ON crm_llamadas_visitas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_llam_delete" ON crm_llamadas_visitas;
CREATE POLICY "crm_llam_delete" ON crm_llamadas_visitas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. MEDICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_medicacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  nombre_medicamento text NOT NULL,
  dosis text DEFAULT '',
  via text DEFAULT 'oral',
  frecuencia text DEFAULT '',
  hora_inicio text DEFAULT '',
  fecha_inicio date,
  fecha_fin date,
  prescriptor text DEFAULT '',
  observaciones text DEFAULT '',
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_medicacion ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_medicacion_residente ON crm_medicacion(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_medicacion_activo ON crm_medicacion(activo);

DROP POLICY IF EXISTS "crm_med_select" ON crm_medicacion;
CREATE POLICY "crm_med_select" ON crm_medicacion FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_med_insert" ON crm_medicacion;
CREATE POLICY "crm_med_insert" ON crm_medicacion FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_med_update" ON crm_medicacion;
CREATE POLICY "crm_med_update" ON crm_medicacion FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_med_delete" ON crm_medicacion;
CREATE POLICY "crm_med_delete" ON crm_medicacion FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. MEDICACIÓN ADMINISTRACIÓN
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_medicacion_administracion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicacion_id uuid NOT NULL REFERENCES crm_medicacion(id) ON DELETE CASCADE,
  fecha_hora timestamptz NOT NULL DEFAULT now(),
  administrada boolean NOT NULL DEFAULT true,
  motivo_no_admin text DEFAULT '',
  administrado_por_nombre text DEFAULT '',
  observaciones text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE crm_medicacion_administracion ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_med_admin_med ON crm_medicacion_administracion(medicacion_id);
CREATE INDEX IF NOT EXISTS idx_crm_med_admin_fecha ON crm_medicacion_administracion(fecha_hora DESC);

DROP POLICY IF EXISTS "crm_med_admin_select" ON crm_medicacion_administracion;
CREATE POLICY "crm_med_admin_select" ON crm_medicacion_administracion FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_med_admin_insert" ON crm_medicacion_administracion;
CREATE POLICY "crm_med_admin_insert" ON crm_medicacion_administracion FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_med_admin_update" ON crm_medicacion_administracion;
CREATE POLICY "crm_med_admin_update" ON crm_medicacion_administracion FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_med_admin_delete" ON crm_medicacion_administracion;
CREATE POLICY "crm_med_admin_delete" ON crm_medicacion_administracion FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ACTIVIDADES Y TALLERES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_actividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid REFERENCES centros(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descripcion text DEFAULT '',
  tipo text DEFAULT 'taller',
  fecha date NOT NULL,
  hora_inicio text DEFAULT '',
  hora_fin text DEFAULT '',
  responsable_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_actividades ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_actividades_fecha ON crm_actividades(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_crm_actividades_centro ON crm_actividades(centro_id);

DROP POLICY IF EXISTS "crm_act_select" ON crm_actividades;
CREATE POLICY "crm_act_select" ON crm_actividades FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_act_insert" ON crm_actividades;
CREATE POLICY "crm_act_insert" ON crm_actividades FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_act_update" ON crm_actividades;
CREATE POLICY "crm_act_update" ON crm_actividades FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_act_delete" ON crm_actividades;
CREATE POLICY "crm_act_delete" ON crm_actividades FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ACTIVIDAD PARTICIPANTES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_actividad_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actividad_id uuid NOT NULL REFERENCES crm_actividades(id) ON DELETE CASCADE,
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  observaciones text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (actividad_id, usuario_servicio_id)
);
ALTER TABLE crm_actividad_participantes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_act_part_actividad ON crm_actividad_participantes(actividad_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_part_residente ON crm_actividad_participantes(usuario_servicio_id);

DROP POLICY IF EXISTS "crm_act_part_select" ON crm_actividad_participantes;
CREATE POLICY "crm_act_part_select" ON crm_actividad_participantes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_act_part_insert" ON crm_actividad_participantes;
CREATE POLICY "crm_act_part_insert" ON crm_actividad_participantes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_act_part_update" ON crm_actividad_participantes;
CREATE POLICY "crm_act_part_update" ON crm_actividad_participantes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_act_part_delete" ON crm_actividad_participantes;
CREATE POLICY "crm_act_part_delete" ON crm_actividad_participantes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ABVD
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_abvd (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  alimentacion text DEFAULT 'normal',
  higiene text DEFAULT 'normal',
  vestido text DEFAULT 'normal',
  movilidad text DEFAULT 'normal',
  esfinteres text DEFAULT 'normal',
  sueno text DEFAULT 'normal',
  observaciones text DEFAULT '',
  autor_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_abvd ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_abvd_residente ON crm_abvd(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_abvd_fecha ON crm_abvd(fecha DESC);

DROP POLICY IF EXISTS "crm_abvd_select" ON crm_abvd;
CREATE POLICY "crm_abvd_select" ON crm_abvd FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_abvd_insert" ON crm_abvd;
CREATE POLICY "crm_abvd_insert" ON crm_abvd FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_abvd_update" ON crm_abvd;
CREATE POLICY "crm_abvd_update" ON crm_abvd FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_abvd_delete" ON crm_abvd;
CREATE POLICY "crm_abvd_delete" ON crm_abvd FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. INCIDENCIAS SANITARIAS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_incidencias_sanitarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  centro_id uuid REFERENCES centros(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  fecha_hora timestamptz NOT NULL DEFAULT now(),
  descripcion text NOT NULL,
  gravedad text DEFAULT 'leve',
  accion_realizada text DEFAULT '',
  requiere_traslado boolean DEFAULT false,
  notificada_familia boolean DEFAULT false,
  estado text DEFAULT 'abierta',
  fecha_cierre timestamptz,
  autor_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_incidencias_sanitarias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_inc_san_residente ON crm_incidencias_sanitarias(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_inc_san_fecha ON crm_incidencias_sanitarias(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_crm_inc_san_estado ON crm_incidencias_sanitarias(estado);

DROP POLICY IF EXISTS "crm_inc_san_select" ON crm_incidencias_sanitarias;
CREATE POLICY "crm_inc_san_select" ON crm_incidencias_sanitarias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_inc_san_insert" ON crm_incidencias_sanitarias;
CREATE POLICY "crm_inc_san_insert" ON crm_incidencias_sanitarias FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_inc_san_update" ON crm_incidencias_sanitarias;
CREATE POLICY "crm_inc_san_update" ON crm_incidencias_sanitarias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_inc_san_delete" ON crm_incidencias_sanitarias;
CREATE POLICY "crm_inc_san_delete" ON crm_incidencias_sanitarias FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. PAUTAS PROFESIONALES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_pautas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  tipo_profesional text NOT NULL,
  pauta text NOT NULL,
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date,
  activa boolean DEFAULT true,
  autor_id uuid,
  autor_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_pautas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_pautas_residente ON crm_pautas(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_pautas_activa ON crm_pautas(activa);

DROP POLICY IF EXISTS "crm_pautas_select" ON crm_pautas;
CREATE POLICY "crm_pautas_select" ON crm_pautas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_pautas_insert" ON crm_pautas;
CREATE POLICY "crm_pautas_insert" ON crm_pautas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pautas_update" ON crm_pautas;
CREATE POLICY "crm_pautas_update" ON crm_pautas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pautas_delete" ON crm_pautas;
CREATE POLICY "crm_pautas_delete" ON crm_pautas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. PAI / PIE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_pai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'PAI',
  version integer NOT NULL DEFAULT 1,
  fecha_creacion date NOT NULL DEFAULT CURRENT_DATE,
  fecha_revision date,
  fecha_cierre date,
  objetivos text DEFAULT '',
  areas_intervencion text DEFAULT '',
  profesionales_involucrados text DEFAULT '',
  evaluacion text DEFAULT '',
  estado text DEFAULT 'borrador',
  creado_por_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_pai ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_pai_residente ON crm_pai(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_pai_estado ON crm_pai(estado);

DROP POLICY IF EXISTS "crm_pai_select" ON crm_pai;
CREATE POLICY "crm_pai_select" ON crm_pai FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_pai_insert" ON crm_pai;
CREATE POLICY "crm_pai_insert" ON crm_pai FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pai_update" ON crm_pai;
CREATE POLICY "crm_pai_update" ON crm_pai FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pai_delete" ON crm_pai;
CREATE POLICY "crm_pai_delete" ON crm_pai FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. SESIONES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  usuario_servicio_id uuid REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  actividad_id uuid REFERENCES crm_actividades(id) ON DELETE SET NULL,
  centro_id uuid REFERENCES centros(id) ON DELETE SET NULL,
  tipo_profesional text NOT NULL,
  fecha date NOT NULL,
  hora_inicio text DEFAULT '',
  hora_fin text DEFAULT '',
  descripcion text NOT NULL,
  objetivos text DEFAULT '',
  resultados text DEFAULT '',
  participante_nombre text DEFAULT '',
  autor_id uuid,
  autor_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_sesiones ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_sesiones_residente ON crm_sesiones(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_sesiones_fecha ON crm_sesiones(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_crm_sesiones_tipo ON crm_sesiones(tipo);

DROP POLICY IF EXISTS "crm_sesiones_select" ON crm_sesiones;
CREATE POLICY "crm_sesiones_select" ON crm_sesiones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_sesiones_insert" ON crm_sesiones;
CREATE POLICY "crm_sesiones_insert" ON crm_sesiones FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_sesiones_update" ON crm_sesiones;
CREATE POLICY "crm_sesiones_update" ON crm_sesiones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_sesiones_delete" ON crm_sesiones;
CREATE POLICY "crm_sesiones_delete" ON crm_sesiones FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. ACTAS Y REUNIONES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crm_actas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid REFERENCES centros(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  tipo text DEFAULT 'reunion',
  fecha date NOT NULL,
  participantes text DEFAULT '',
  contenido text NOT NULL,
  acuerdos text DEFAULT '',
  autor_id uuid,
  autor_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE crm_actas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_actas_fecha ON crm_actas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_crm_actas_centro ON crm_actas(centro_id);

DROP POLICY IF EXISTS "crm_actas_select" ON crm_actas;
CREATE POLICY "crm_actas_select" ON crm_actas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_actas_insert" ON crm_actas;
CREATE POLICY "crm_actas_insert" ON crm_actas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_actas_update" ON crm_actas;
CREATE POLICY "crm_actas_update" ON crm_actas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_actas_delete" ON crm_actas;
CREATE POLICY "crm_actas_delete" ON crm_actas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));