/*
# Módulo Bajas/Ausencias — Tipo Absentismo, Justificante, Reposo y Balance Finalizaciones

## Descripción
Ampliación del módulo de bajas y sustituciones con:

1. Clasificación oficial del tipo de absentismo (IT, AT, PR, PNR, Reposo)
2. Gestión del justificante para bajas de tipo PNR (pendiente/entregado + ruta del archivo)
3. Duración del reposo prescrito (24h, 48h, 72h)
4. Sustituciones standalone (no vinculadas a una baja concreta) con motivo de extra
5. Control de finalizaciones del balance por trabajador (Pagar / Compensar)

## Tablas modificadas

### bajas_temporales
- `tipo_absentismo` (text): Código del tipo — IT, AT, PR, PNR o Reposo.
- `justificante_estado` (text): Estado del justificante cuando tipo_absentismo = PNR — 'pendiente' o 'entregado'. Por defecto 'pendiente'.
- `justificante_wasabi_key` (text): Ruta del archivo de justificante subido a Wasabi.
- `reposo_horas` (integer): Horas de reposo prescrito (24, 48 o 72) cuando tipo_absentismo = Reposo.

### sustituciones
- `baja_id` pasa a ser nullable para permitir sustituciones independientes (sin baja asociada).
- `motivo_extra` (text): Motivo del turno extra — 'vacante_turno' o 'refuerzo_extra'.
- `comentario_extra` (text): Comentario libre cuando motivo_extra = refuerzo_extra.
- `finalizado` (boolean): Marca si esta sustitución ya ha sido liquidada (pagada o compensada). Por defecto false.
- `finalizado_at` (timestamptz): Fecha/hora en que se finalizó.

## Nuevas tablas

### balance_finalizaciones
Registra cada liquidación del balance de un sustituto:
- `id` (uuid, PK)
- `sustituto_id` (text): ID del empleado sustituto.
- `sustituto_nombre` (text): Nombre del sustituto en el momento de la liquidación.
- `tipo` (text): 'pagar' o 'compensar'.
- `horas` (numeric): Total de horas liquidadas en esta operación.
- `comentario` (text, nullable): Texto libre adjunto a la liquidación.
- `anio` (integer): Año al que corresponde la liquidación.
- `society_id` (text, nullable): Sociedad a la que pertenece.
- `created_by` (text, nullable): Usuario que realizó la liquidación.
- `created_at` (timestamptz): Marca de tiempo.

## Seguridad
- RLS habilitado en balance_finalizaciones con políticas para anon + authenticated (aplicación interna sin login separado).

## Notas importantes
1. La columna baja_id en sustituciones se vuelve nullable; los registros existentes no se ven afectados.
2. Los cambios en bajas_temporales son aditivos; ningún dato existente se modifica.
3. La tabla balance_finalizaciones es nueva y no afecta datos actuales.
*/

-- ── bajas_temporales: nuevas columnas ─────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bajas_temporales' AND column_name = 'tipo_absentismo'
  ) THEN
    ALTER TABLE bajas_temporales ADD COLUMN tipo_absentismo TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bajas_temporales' AND column_name = 'justificante_estado'
  ) THEN
    ALTER TABLE bajas_temporales ADD COLUMN justificante_estado TEXT DEFAULT 'pendiente';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bajas_temporales' AND column_name = 'justificante_wasabi_key'
  ) THEN
    ALTER TABLE bajas_temporales ADD COLUMN justificante_wasabi_key TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bajas_temporales' AND column_name = 'reposo_horas'
  ) THEN
    ALTER TABLE bajas_temporales ADD COLUMN reposo_horas INTEGER;
  END IF;
END $$;

-- ── sustituciones: baja_id nullable + nuevas columnas ─────────────────────────

ALTER TABLE sustituciones ALTER COLUMN baja_id DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sustituciones' AND column_name = 'motivo_extra'
  ) THEN
    ALTER TABLE sustituciones ADD COLUMN motivo_extra TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sustituciones' AND column_name = 'comentario_extra'
  ) THEN
    ALTER TABLE sustituciones ADD COLUMN comentario_extra TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sustituciones' AND column_name = 'finalizado'
  ) THEN
    ALTER TABLE sustituciones ADD COLUMN finalizado BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sustituciones' AND column_name = 'finalizado_at'
  ) THEN
    ALTER TABLE sustituciones ADD COLUMN finalizado_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── balance_finalizaciones: nueva tabla ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS balance_finalizaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sustituto_id TEXT NOT NULL,
  sustituto_nombre TEXT NOT NULL,
  tipo         TEXT NOT NULL,
  horas        NUMERIC NOT NULL DEFAULT 0,
  comentario   TEXT,
  anio         INTEGER NOT NULL,
  society_id   TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE balance_finalizaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bf_select" ON balance_finalizaciones;
CREATE POLICY "bf_select" ON balance_finalizaciones FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bf_insert" ON balance_finalizaciones;
CREATE POLICY "bf_insert" ON balance_finalizaciones FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "bf_update" ON balance_finalizaciones;
CREATE POLICY "bf_update" ON balance_finalizaciones FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bf_delete" ON balance_finalizaciones;
CREATE POLICY "bf_delete" ON balance_finalizaciones FOR DELETE
  TO anon, authenticated USING (true);

-- Índice para consultas por sustituto y año
CREATE INDEX IF NOT EXISTS idx_balance_fin_sustituto_anio
  ON balance_finalizaciones (sustituto_id, anio);

-- Índice sustituciones standalone (baja_id null)
CREATE INDEX IF NOT EXISTS idx_sustituciones_standalone
  ON sustituciones (sustituto_id) WHERE baja_id IS NULL;
