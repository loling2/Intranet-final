/*
# Ficha ampliada de residentes

## Cambios
1. `usuarios_servicios` añade datos personales y de domicilio:
   - tipo_identificacion, identificacion, genero, tipo_direccion, direccion,
     localidad, provincia, codigo_postal, pais, fecha_nacimiento, estado_civil y foto_url.
2. Nueva tabla `crm_residente_contactos`:
   - Familiares y contactos de emergencia repetibles por residente.
   - Nombre, parentesco, relación jurídica, teléfono, email y contacto principal.
3. Nueva tabla `crm_residente_cuentas`:
   - Datos administrativos/económicos asociados al residente.
   - Tipo de cuenta, titular, identificación del titular, IBAN, entidad y observaciones.
4. Nueva tabla `crm_residente_medico`:
   - Información médica editable como alergias, diagnósticos, movilidad, dependencia y notas.
5. Nueva tabla `crm_residente_tratamiento`:
   - Tratamiento, medicación, pautas y seguimiento del residente.
6. Seguridad:
   - RLS activado en las cuatro tablas nuevas.
   - Admin/RRHH tienen acceso completo.
   - Profesionales solo acceden a la información de residentes que tienen asignados.
   - Los datos personales existentes mantienen las políticas actuales.
*/

ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS tipo_identificacion text DEFAULT 'DNI';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS identificacion text DEFAULT '';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS genero text DEFAULT '';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS tipo_direccion text DEFAULT '';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS direccion text DEFAULT '';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS localidad text DEFAULT '';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS provincia text DEFAULT '';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS codigo_postal text DEFAULT '';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS pais text DEFAULT 'España';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS fecha_nacimiento date;
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS estado_civil text DEFAULT '';
ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS foto_url text;

CREATE TABLE IF NOT EXISTS crm_residente_contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  parentesco text DEFAULT '',
  relacion_juridica text DEFAULT '',
  telefono text DEFAULT '',
  email text DEFAULT '',
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_residente_cuentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  tipo_cuenta text DEFAULT '',
  titular text DEFAULT '',
  identificacion_titular text DEFAULT '',
  iban text DEFAULT '',
  entidad text DEFAULT '',
  observaciones text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_residente_medico (
  usuario_servicio_id uuid PRIMARY KEY REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  alergias text DEFAULT '',
  diagnosticos text DEFAULT '',
  movilidad text DEFAULT '',
  dependencia text DEFAULT '',
  notas text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_residente_tratamiento (
  usuario_servicio_id uuid PRIMARY KEY REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  tratamiento text DEFAULT '',
  medicacion text DEFAULT '',
  pautas text DEFAULT '',
  seguimiento text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_residente_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_residente_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_residente_medico ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_residente_tratamiento ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_contactos_residente ON crm_residente_contactos (usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_cuentas_residente ON crm_residente_cuentas (usuario_servicio_id);

-- Contactos
DROP POLICY IF EXISTS "crm_contactos_select" ON crm_residente_contactos;
CREATE POLICY "crm_contactos_select" ON crm_residente_contactos FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_contactos.usuario_servicio_id AND a.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "crm_contactos_insert" ON crm_residente_contactos;
CREATE POLICY "crm_contactos_insert" ON crm_residente_contactos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_contactos.usuario_servicio_id AND a.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "crm_contactos_update" ON crm_residente_contactos;
CREATE POLICY "crm_contactos_update" ON crm_residente_contactos FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_contactos.usuario_servicio_id AND a.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_contactos.usuario_servicio_id AND a.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "crm_contactos_delete" ON crm_residente_contactos;
CREATE POLICY "crm_contactos_delete" ON crm_residente_contactos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_contactos.usuario_servicio_id AND a.user_id = auth.uid()));

-- Cuentas
DROP POLICY IF EXISTS "crm_cuentas_select" ON crm_residente_cuentas;
CREATE POLICY "crm_cuentas_select" ON crm_residente_cuentas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_cuentas.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_cuentas_insert" ON crm_residente_cuentas;
CREATE POLICY "crm_cuentas_insert" ON crm_residente_cuentas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_cuentas.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_cuentas_update" ON crm_residente_cuentas;
CREATE POLICY "crm_cuentas_update" ON crm_residente_cuentas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_cuentas.usuario_servicio_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_cuentas.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_cuentas_delete" ON crm_residente_cuentas;
CREATE POLICY "crm_cuentas_delete" ON crm_residente_cuentas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_cuentas.usuario_servicio_id AND a.user_id = auth.uid()));

-- Médico y tratamiento: misma regla de acceso
DROP POLICY IF EXISTS "crm_medico_select" ON crm_residente_medico;
CREATE POLICY "crm_medico_select" ON crm_residente_medico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_medico.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_medico_insert" ON crm_residente_medico;
CREATE POLICY "crm_medico_insert" ON crm_residente_medico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_medico.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_medico_update" ON crm_residente_medico;
CREATE POLICY "crm_medico_update" ON crm_residente_medico FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_medico.usuario_servicio_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_medico.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_medico_delete" ON crm_residente_medico;
CREATE POLICY "crm_medico_delete" ON crm_residente_medico FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_medico.usuario_servicio_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "crm_tratamiento_select" ON crm_residente_tratamiento;
CREATE POLICY "crm_tratamiento_select" ON crm_residente_tratamiento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_tratamiento.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_tratamiento_insert" ON crm_residente_tratamiento;
CREATE POLICY "crm_tratamiento_insert" ON crm_residente_tratamiento FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_tratamiento.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_tratamiento_update" ON crm_residente_tratamiento;
CREATE POLICY "crm_tratamiento_update" ON crm_residente_tratamiento FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_tratamiento.usuario_servicio_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_tratamiento.usuario_servicio_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "crm_tratamiento_delete" ON crm_residente_tratamiento;
CREATE POLICY "crm_tratamiento_delete" ON crm_residente_tratamiento FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) OR EXISTS (SELECT 1 FROM crm_paciente_asignaciones a WHERE a.usuario_servicio_id = crm_residente_tratamiento.usuario_servicio_id AND a.user_id = auth.uid()));