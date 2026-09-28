/*
# Moodle: cursos, contenido y asignaciones

Crea el sistema de cursos tipo Moodle. Desde Formacion se crean cursos, se sube
contenido (texto, PDF, PowerPoint, videos) a Wasabi, y se asignan a empleados.
Desde el perfil Empleado, una pestana "Moodle" muestra los cursos asignados.

## Tablas
1. moodle_cursos — cursos creados por formacion
2. moodle_contenido — recursos de cada curso (texto, archivos, enlaces)
3. moodle_asignaciones — asignaciones de cursos a empleados

## Seguridad
- Staff (formacion, admin, rrhh, etc.) puede CRUD en todo.
- Empleados pueden SELECT sus cursos asignados y su contenido.
- Todas las tablas con RLS habilitado.
*/

-- ── 1. moodle_asignaciones (creada primero por la FK circular) ────────────
CREATE TABLE IF NOT EXISTS public.moodle_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL,
  empleado_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_curso','completado')),
  progreso integer NOT NULL DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  fecha_asignacion timestamptz NOT NULL DEFAULT now(),
  fecha_completado timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS moodle_asignaciones_curso_empleado_uniq
  ON public.moodle_asignaciones (curso_id, empleado_id);

CREATE INDEX IF NOT EXISTS moodle_asignaciones_empleado_idx
  ON public.moodle_asignaciones(empleado_id);

ALTER TABLE public.moodle_asignaciones ENABLE ROW LEVEL SECURITY;

-- ── 2. moodle_cursos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moodle_cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  categoria text,
  duracion_estimada text,
  wasabi_prefix text NOT NULL,
  creado_por uuid NOT NULL DEFAULT auth.uid(),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moodle_cursos ENABLE ROW LEVEL SECURITY;

-- FK de moodle_asignaciones a moodle_cursos (ahora que existe)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moodle_asignaciones_curso_id_fkey') THEN
    ALTER TABLE public.moodle_asignaciones
      ADD CONSTRAINT moodle_asignaciones_curso_id_fkey
      FOREIGN KEY (curso_id) REFERENCES public.moodle_cursos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 3. moodle_contenido ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moodle_contenido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.moodle_cursos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('texto','pdf','powerpoint','video','enlace')),
  contenido_texto text,
  wasabi_key text,
  url_externa text,
  nombre_archivo text,
  tamano_bytes bigint,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moodle_contenido_curso_id_idx ON public.moodle_contenido(curso_id);

ALTER TABLE public.moodle_contenido ENABLE ROW LEVEL SECURITY;

-- ── Politicas RLS ──────────────────────────────────────────────────────────

-- moodle_cursos SELECT
DROP POLICY IF EXISTS "select_moodle_cursos" ON public.moodle_cursos;
CREATE POLICY "select_moodle_cursos" ON public.moodle_cursos
  FOR SELECT TO authenticated USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.moodle_asignaciones ma
      WHERE ma.curso_id = moodle_cursos.id
        AND EXISTS (
          SELECT 1 FROM public.empleados e
          WHERE e.id = ma.empleado_id AND e.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "insert_moodle_cursos" ON public.moodle_cursos;
CREATE POLICY "insert_moodle_cursos" ON public.moodle_cursos
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "update_moodle_cursos" ON public.moodle_cursos;
CREATE POLICY "update_moodle_cursos" ON public.moodle_cursos
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "delete_moodle_cursos" ON public.moodle_cursos;
CREATE POLICY "delete_moodle_cursos" ON public.moodle_cursos
  FOR DELETE TO authenticated USING (public.is_staff());

-- moodle_contenido SELECT
DROP POLICY IF EXISTS "select_moodle_contenido" ON public.moodle_contenido;
CREATE POLICY "select_moodle_contenido" ON public.moodle_contenido
  FOR SELECT TO authenticated USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.moodle_asignaciones ma
      WHERE ma.curso_id = moodle_contenido.curso_id
        AND EXISTS (
          SELECT 1 FROM public.empleados e
          WHERE e.id = ma.empleado_id AND e.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "insert_moodle_contenido" ON public.moodle_contenido;
CREATE POLICY "insert_moodle_contenido" ON public.moodle_contenido
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "update_moodle_contenido" ON public.moodle_contenido;
CREATE POLICY "update_moodle_contenido" ON public.moodle_contenido
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "delete_moodle_contenido" ON public.moodle_contenido;
CREATE POLICY "delete_moodle_contenido" ON public.moodle_contenido
  FOR DELETE TO authenticated USING (public.is_staff());

-- moodle_asignaciones SELECT
DROP POLICY IF EXISTS "select_moodle_asignaciones" ON public.moodle_asignaciones;
CREATE POLICY "select_moodle_asignaciones" ON public.moodle_asignaciones
  FOR SELECT TO authenticated USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.empleados e
      WHERE e.id = moodle_asignaciones.empleado_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_moodle_asignaciones" ON public.moodle_asignaciones;
CREATE POLICY "insert_moodle_asignaciones" ON public.moodle_asignaciones
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "update_moodle_asignaciones" ON public.moodle_asignaciones;
CREATE POLICY "update_moodle_asignaciones" ON public.moodle_asignaciones
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "delete_moodle_asignaciones" ON public.moodle_asignaciones;
CREATE POLICY "delete_moodle_asignaciones" ON public.moodle_asignaciones
  FOR DELETE TO authenticated USING (public.is_staff());
