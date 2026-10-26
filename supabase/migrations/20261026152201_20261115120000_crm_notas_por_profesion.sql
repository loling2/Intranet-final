/*
# Notas diarias por profesión en CRM Seguimiento

## Propósito
Añade la posibilidad de que los profesionales (psicólogos, gerocultores,
enfermeros, fisios, etc.) registren notas diarias sobre cada residente en el
módulo de Seguimiento Diario del CRM. Las notas se separan por profesión: un
psicólogo solo ve las notas de psicólogos, un gerocultor solo las de gerocultores,
etc. Cada nota lleva fecha (registro diario que cambia de día a las 00:00) y se
puede navegar con un calendario. No afecta al funcionamiento existente
(crm_seguimiento_diario se mantiene intacto).

## Cambios

### 1. user_profiles — nueva columna `profesion`
- `profesion` (text, nullable) — guarda la profesión del usuario:
  'psicologo' | 'gerocultor' | 'enfermero' | 'fisio' | 'trabajador_social' |
  'medico' | 'auxiliar' | 'terapeuta_ocupacional' | otro texto libre.
  Es nullable para no forzar un valor en usuarios ya existentes.

### 2. Nueva tabla `crm_notas_profesion`
Notas diarias por profesión, una por residente por día por profesión por autor.
- id (uuid PK)
- usuario_servicio_id (uuid FK → usuarios_servicios ON DELETE CASCADE) — residente
- autor_id (uuid, NOT NULL, DEFAULT auth.uid()) — profesional que escribe
- profesion (text NOT NULL) — profesión del autor en el momento de escribir
- fecha (date NOT NULL) — día del registro (cambia a las 00:00)
- contenido (text NOT NULL) — texto de la nota
- created_at, updated_at (timestamptz)

Índices: (usuario_servicio_id, fecha desc), (usuario_servicio_id, profesion, fecha desc).

### 3. Seguridad (RLS)
- RLS habilitada en crm_notas_profesion.
- SELECT: un usuario autenticado ve notas cuya `profesion` coincide con su
  `user_profiles.profesion`, o si es admin/rrhh (puede ver todas).
- INSERT: el autor (auth.uid()) puede insertar solo con su propia profesión;
  `autor_id` se rellena por defecto con auth.uid() y la profesión debe coincidir
  con la del usuario. Admin puede insertar cualquiera.
- UPDATE: solo el autor (autor_id = auth.uid()) o admin.
- DELETE: solo el autor (autor_id = auth.uid()) o admin.
- Grants: SELECT, INSERT, UPDATE, DELETE a authenticated.

### 4. user_profiles — grant de UPDATE de la columna profesion a admin
No se revoca el UPDATE existente; se permite que el admin ajuste la profesión
desde la gestión de usuarios. La profesión es un dato operativo, no un flag
de permisos, por lo que se gestiona desde la UI de UserManagement.
*/

-- 1. Añadir columna profesion a user_profiles (idempotente)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profesion text;

-- 2. Crear tabla crm_notas_profesion
CREATE TABLE IF NOT EXISTS crm_notas_profesion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL DEFAULT auth.uid(),
  profesion text NOT NULL,
  fecha date NOT NULL,
  contenido text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_notas_prof_residente_fecha
  ON crm_notas_profesion (usuario_servicio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_crm_notas_prof_residente_prof_fecha
  ON crm_notas_profesion (usuario_servicio_id, profesion, fecha DESC);

-- 3. RLS
ALTER TABLE crm_notas_profesion ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_notas_profesion TO authenticated;

-- Helper: ¿el usuario actual es admin o rrhh?
-- (inline en las políticas para evitar dependencias de funciones)

-- SELECT: ver notas de tu propia profesión, o todas si admin/rrhh
DROP POLICY IF EXISTS "crm_notas_prof_select_own_profesion" ON crm_notas_profesion;
CREATE POLICY "crm_notas_prof_select_own_profesion"
ON crm_notas_profesion FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role IN ('admin', 'rrhh')
      OR up.profesion = crm_notas_profesion.profesion
      OR (up.profesion IS NULL AND crm_notas_profesion.autor_id = auth.uid())
    )
  )
);

-- INSERT: autor rellenado por defecto con auth.uid(); profesion debe coincidir
-- con la del usuario (o admin puede poner cualquiera)
DROP POLICY IF EXISTS "crm_notas_prof_insert_own" ON crm_notas_profesion;
CREATE POLICY "crm_notas_prof_insert_own"
ON crm_notas_profesion FOR INSERT
TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role IN ('admin', 'rrhh')
      OR up.profesion = crm_notas_profesion.profesion
    )
  )
);

-- UPDATE: solo el autor o admin
DROP POLICY IF EXISTS "crm_notas_prof_update_own" ON crm_notas_profesion;
CREATE POLICY "crm_notas_prof_update_own"
ON crm_notas_profesion FOR UPDATE
TO authenticated
USING (
  autor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
)
WITH CHECK (
  autor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- DELETE: solo el autor o admin
DROP POLICY IF EXISTS "crm_notas_prof_delete_own" ON crm_notas_profesion;
CREATE POLICY "crm_notas_prof_delete_own"
ON crm_notas_profesion FOR DELETE
TO authenticated
USING (
  autor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);
