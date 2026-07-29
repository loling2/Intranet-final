/*
# Fichajes: guardar hora corregida aprobada + soporte permiso con fin

1. Cambios en tabla `fichajes`
- `timestamp_corregido` (timestamptz, nullable): cuando RRHH/admin aprueba una
  corrección, se guarda aquí la nueva hora propuesta por el trabajador.
  El campo `timestamp` original NUNCA se modifica, se conserva intacto.
- `motivo_correccion` (text, nullable): el motivo aportado por el trabajador
  en la corrección aprobada, guardado en el propio fichaje.
- `corregido_por` (text, nullable): nombre de la persona de RRHH/admin que
  aprobó la corrección.
- `corregido_at` (timestamptz, nullable): momento en que se aprobó.

2. Nuevo tipo de evento `permiso_fin`
- El campo `tipo_evento` es text sin constraint CHECK, por lo que no hace falta
  alterar nada. El frontend usará `permiso` para inicio y `permiso_fin` para
  el cierre, permitiendo computar la duración del permiso.

3. Notas importantes
- No se borra ni modifica el `timestamp` original.
- El cálculo de horas en el frontend usará `timestamp_corregido` si existe,
  y si no, `timestamp` original.
- El tiempo de permiso (entre `permiso` y `permiso_fin`) se computa por
  separado para informar al usuario, sin restar de las horas trabajadas.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fichajes' AND column_name = 'timestamp_corregido'
  ) THEN
    ALTER TABLE fichajes ADD COLUMN timestamp_corregido timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fichajes' AND column_name = 'motivo_correccion'
  ) THEN
    ALTER TABLE fichajes ADD COLUMN motivo_correccion text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fichajes' AND column_name = 'corregido_por'
  ) THEN
    ALTER TABLE fichajes ADD COLUMN corregido_por text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fichajes' AND column_name = 'corregido_at'
  ) THEN
    ALTER TABLE fichajes ADD COLUMN corregido_at timestamptz;
  END IF;
END $$;
