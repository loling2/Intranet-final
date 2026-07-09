-- ─── Exam platform tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS examenes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              text NOT NULL,
  descripcion         text,
  duracion_minutos    int  NOT NULL DEFAULT 30,
  validez_meses       int  NOT NULL DEFAULT 12,
  fecha_inicio        date,
  fecha_fin           date,
  ratio_penalizacion  numeric(4,2) NOT NULL DEFAULT 3,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE examenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_select_auth" ON examenes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "exam_insert_admin" ON examenes FOR INSERT
  TO authenticated WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "exam_update_admin" ON examenes FOR UPDATE
  TO authenticated USING (is_admin_or_rrhh()) WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "exam_delete_admin" ON examenes FOR DELETE
  TO authenticated USING (is_admin_or_rrhh());


-- ─── Questions ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS preguntas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examen_id         uuid NOT NULL REFERENCES examenes(id) ON DELETE CASCADE,
  texto             text NOT NULL,
  opcion_a          text NOT NULL,
  opcion_b          text NOT NULL,
  opcion_c          text NOT NULL,
  opcion_d          text NOT NULL,
  respuesta_correcta char(1) NOT NULL CHECK (respuesta_correcta IN ('a','b','c','d')),
  orden             int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE preguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pregunta_select_auth" ON preguntas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "pregunta_insert_admin" ON preguntas FOR INSERT
  TO authenticated WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "pregunta_update_admin" ON preguntas FOR UPDATE
  TO authenticated USING (is_admin_or_rrhh()) WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "pregunta_delete_admin" ON preguntas FOR DELETE
  TO authenticated USING (is_admin_or_rrhh());


-- ─── Assignments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asignaciones_examenes (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id                uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  examen_id                 uuid NOT NULL REFERENCES examenes(id) ON DELETE CASCADE,
  estado                    text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','suspendido')),
  nota                      numeric(5,2),
  fecha_realizacion         timestamptz,
  fecha_caducidad_certificado date,
  intentos_realizados       int NOT NULL DEFAULT 0,
  intentos_permitidos       int,   -- NULL = unlimited
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, examen_id)
);

ALTER TABLE asignaciones_examenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asig_select_own" ON asignaciones_examenes FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id OR is_admin_or_rrhh());

CREATE POLICY "asig_insert_admin" ON asignaciones_examenes FOR INSERT
  TO authenticated WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "asig_update_admin_or_own" ON asignaciones_examenes FOR UPDATE
  TO authenticated USING (auth.uid() = usuario_id OR is_admin_or_rrhh())
  WITH CHECK (auth.uid() = usuario_id OR is_admin_or_rrhh());

CREATE POLICY "asig_delete_admin" ON asignaciones_examenes FOR DELETE
  TO authenticated USING (is_admin_or_rrhh());


-- ─── Certificates ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certificados_examenes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  examen_id     uuid NOT NULL REFERENCES examenes(id) ON DELETE CASCADE,
  url_pdf       text,
  fecha_emision timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE certificados_examenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_select_own" ON certificados_examenes FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id OR is_admin_or_rrhh());

CREATE POLICY "cert_insert_admin_or_own" ON certificados_examenes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = usuario_id OR is_admin_or_rrhh());

CREATE POLICY "cert_update_admin" ON certificados_examenes FOR UPDATE
  TO authenticated USING (is_admin_or_rrhh()) WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "cert_delete_admin" ON certificados_examenes FOR DELETE
  TO authenticated USING (is_admin_or_rrhh());
