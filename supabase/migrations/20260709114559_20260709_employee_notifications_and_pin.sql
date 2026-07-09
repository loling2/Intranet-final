/*
# Employee Notifications + PIN triggers

## Purpose
Creates a per-user notification system so employees see a badge on the bell icon
when a new nomina or PRL document has been uploaded for them.

## New Tables
- `notificaciones_empleado`: stores one row per notification per employee
  - `id` uuid PK
  - `user_id` uuid – references the employee's auth user id (user_profiles.id)
  - `tipo` text – 'nomina' or 'prl'
  - `titulo` text – short title shown in the panel
  - `descripcion` text – detail line
  - `referencia_id` uuid – id of the source nomina / prl_document row
  - `leida` boolean default false – cleared once the employee opens the panel
  - `created_at` timestamptz

## Triggers
1. `trg_notify_nomina` – fires AFTER INSERT on `nominas`. Looks up the
   user_profile whose `dni` matches the nomina's `dni` and inserts a notification.
2. `trg_notify_prl_doc` – fires AFTER INSERT on `prl_documents`. Inserts a
   notification for every active user with role = 'empleado'.

## Security
- RLS enabled on `notificaciones_empleado`.
- Employees (authenticated) can SELECT and UPDATE (mark-as-read) their own rows.
- Admins / RRHH can INSERT manually if needed.
- Trigger functions are SECURITY DEFINER so they bypass RLS and write freely.
*/

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notificaciones_empleado (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('nomina', 'prl')),
  titulo        text NOT NULL,
  descripcion   text NOT NULL DEFAULT '',
  referencia_id uuid,
  leida         boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_emp_user_leida ON notificaciones_empleado(user_id, leida);

ALTER TABLE notificaciones_empleado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_select_own_notifs" ON notificaciones_empleado;
CREATE POLICY "employee_select_own_notifs" ON notificaciones_empleado FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "employee_update_own_notifs" ON notificaciones_empleado;
CREATE POLICY "employee_update_own_notifs" ON notificaciones_empleado FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_rrhh_insert_notifs" ON notificaciones_empleado;
CREATE POLICY "admin_rrhh_insert_notifs" ON notificaciones_empleado FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh', 'prevencion')
    )
  );

-- ─── Trigger: nomina uploaded → notify matching employee ─────────────────────

CREATE OR REPLACE FUNCTION notify_on_nomina_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_mes_nombre text;
BEGIN
  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE dni = NEW.dni
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_mes_nombre := to_char(to_date(NEW.mes::text, 'MM'), 'TMMonth');

  INSERT INTO notificaciones_empleado (user_id, tipo, titulo, descripcion, referencia_id)
  VALUES (
    v_user_id,
    'nomina',
    'Nueva nomina disponible',
    v_mes_nombre || ' ' || NEW.anio::text ||
      CASE WHEN NEW.sociedad_nombre IS NOT NULL AND NEW.sociedad_nombre <> ''
           THEN ' · ' || NEW.sociedad_nombre ELSE '' END,
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_nomina ON nominas;
CREATE TRIGGER trg_notify_nomina
  AFTER INSERT ON nominas
  FOR EACH ROW EXECUTE FUNCTION notify_on_nomina_insert();

-- ─── Trigger: PRL document uploaded → notify all active employees ────────────

CREATE OR REPLACE FUNCTION notify_on_prl_doc_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notificaciones_empleado (user_id, tipo, titulo, descripcion, referencia_id)
  SELECT
    up.id,
    'prl',
    'Nuevo documento PRL',
    NEW.nombre_archivo,
    NEW.id
  FROM user_profiles up
  WHERE up.role = 'empleado' AND up.activo = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_prl_doc ON prl_documents;
CREATE TRIGGER trg_notify_prl_doc
  AFTER INSERT ON prl_documents
  FOR EACH ROW EXECUTE FUNCTION notify_on_prl_doc_insert();
