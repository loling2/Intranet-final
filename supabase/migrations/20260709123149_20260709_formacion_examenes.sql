/*
# Modulo de Formacion: Tablas de Examenes

## Resumen
Crea las tablas necesarias para el modulo de Formacion (gestion de examenes),
registra el perfil "formacion" en custom_profiles para que aparezca en el
gestor de permisos de pestanas, y siembra los permisos iniciales para ese
perfil.

## Nuevas Tablas

### examenes
Almacena la definicion de cada examen que puede ser creado por el gestor de
formacion.
- id: UUID clave primaria
- titulo: nombre del examen (obligatorio)
- descripcion: descripcion opcional del contenido
- fecha_inicio / fecha_fin: rango de vigencia del examen (dates)
- duracion_minutos: duracion maxima para realizarlo
- puntuacion_minima: nota minima para aprobar (por defecto 60)
- sociedad_id: sociedad a la que pertenece el examen (texto, puede ser NULL para todas)
- estado: borrador | activo | finalizado
- created_at: fecha de creacion

### examen_asignaciones
Registra la asignacion de un examen a un empleado y el resultado.
- id: UUID clave primaria
- examen_id: referencia a examenes(id) con cascade delete
- empleado_id: UUID del empleado (referencia logica, sin FK estricta)
- nombre_empleado: nombre en texto plano para mostrar sin join
- dni: DNI del empleado para identificacion
- estado: pendiente | en_curso | completado | suspendido
- puntuacion: nota obtenida (entero, nullable)
- fecha_realizacion: cuando completo el examen
- notas: observaciones adicionales
- created_at: fecha de asignacion

## Cambios en Tablas Existentes
- Ninguno

## Seguridad
- RLS habilitado en ambas tablas
- Usuarios autenticados pueden leer y escribir (los roles se gestionan en la app)
- Politicas separadas por operacion (SELECT, INSERT, UPDATE, DELETE)

## Notas
1. Se inserta el perfil "formacion" en custom_profiles para que aparezca
   en el gestor de permisos de pestanas (RoleTabPermissionsManager).
2. Se siembran permisos en role_tab_permissions para el rol "formacion":
   pestanas habilitadas: overview y exams (examenes).
3. Uso de ON CONFLICT DO NOTHING para idempotencia en los inserts de seed.
*/

-- ─── Tabla examenes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS examenes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text NOT NULL,
  descripcion      text,
  fecha_inicio     date,
  fecha_fin        date,
  duracion_minutos int,
  puntuacion_minima int NOT NULL DEFAULT 60,
  sociedad_id      text,
  estado           text NOT NULL DEFAULT 'activo'
                   CHECK (estado IN ('borrador', 'activo', 'finalizado')),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE examenes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formacion_select_examenes" ON examenes;
CREATE POLICY "formacion_select_examenes" ON examenes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "formacion_insert_examenes" ON examenes;
CREATE POLICY "formacion_insert_examenes" ON examenes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "formacion_update_examenes" ON examenes;
CREATE POLICY "formacion_update_examenes" ON examenes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "formacion_delete_examenes" ON examenes;
CREATE POLICY "formacion_delete_examenes" ON examenes
  FOR DELETE TO authenticated USING (true);

-- ─── Tabla examen_asignaciones ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS examen_asignaciones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examen_id         uuid NOT NULL REFERENCES examenes(id) ON DELETE CASCADE,
  empleado_id       uuid,
  nombre_empleado   text NOT NULL,
  dni               text,
  estado            text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'en_curso', 'completado', 'suspendido')),
  puntuacion        int,
  fecha_realizacion timestamptz,
  notas             text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_examen_asignaciones_examen_id
  ON examen_asignaciones(examen_id);

CREATE INDEX IF NOT EXISTS idx_examen_asignaciones_empleado_id
  ON examen_asignaciones(empleado_id);

ALTER TABLE examen_asignaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formacion_select_asignaciones" ON examen_asignaciones;
CREATE POLICY "formacion_select_asignaciones" ON examen_asignaciones
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "formacion_insert_asignaciones" ON examen_asignaciones;
CREATE POLICY "formacion_insert_asignaciones" ON examen_asignaciones
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "formacion_update_asignaciones" ON examen_asignaciones;
CREATE POLICY "formacion_update_asignaciones" ON examen_asignaciones
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "formacion_delete_asignaciones" ON examen_asignaciones;
CREATE POLICY "formacion_delete_asignaciones" ON examen_asignaciones
  FOR DELETE TO authenticated USING (true);

-- ─── Seed: perfil "formacion" en custom_profiles ─────────────────────────────

INSERT INTO custom_profiles (id, label, color)
VALUES ('formacion', 'Formacion', '#0891B2')
ON CONFLICT (id) DO NOTHING;

-- ─── Seed: permisos de pestanas para el rol "formacion" ──────────────────────

INSERT INTO role_tab_permissions (role, tab_id, enabled)
VALUES
  ('formacion', 'overview',   true),
  ('formacion', 'exams',      true),
  ('formacion', 'employees',  true),
  ('formacion', 'vacations',  false),
  ('formacion', 'certificates', false),
  ('formacion', 'users',      false),
  ('formacion', 'vehicles',   false),
  ('formacion', 'documents',  false),
  ('formacion', 'personal-docs', false),
  ('formacion', 'pdf-split',  false),
  ('formacion', 'audit',      false),
  ('formacion', 'contratos',  false),
  ('formacion', 'prevencion', false),
  ('formacion', 'facturas',   false),
  ('formacion', 'incidencias',false),
  ('formacion', 'fichajes',   false),
  ('formacion', 'prl-docs',   false)
ON CONFLICT (role, tab_id) DO NOTHING;
