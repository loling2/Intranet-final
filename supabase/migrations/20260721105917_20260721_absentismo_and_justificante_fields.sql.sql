-- Add tipo_absentismo, reposo_duracion, justificante fields to bajas_temporales
ALTER TABLE bajas_temporales
  ADD COLUMN IF NOT EXISTS tipo_absentismo TEXT,
  ADD COLUMN IF NOT EXISTS reposo_duracion TEXT,
  ADD COLUMN IF NOT EXISTS justificante_estado TEXT DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS justificante_url TEXT;

-- Add check constraint for tipo_absentismo values
ALTER TABLE bajas_temporales
  ADD CONSTRAINT chk_tipo_absentismo
  CHECK (tipo_absentismo IS NULL OR tipo_absentismo IN ('IT', 'AT', 'PR', 'PNR', 'Reposo'));

-- Add check constraint for reposo_duracion values
ALTER TABLE bajas_temporales
  ADD CONSTRAINT chk_reposo_duracion
  CHECK (reposo_duracion IS NULL OR reposo_duracion IN ('24h', '48h', '72h'));

-- Add check constraint for justificante_estado values
ALTER TABLE bajas_temporales
  ADD CONSTRAINT chk_justificante_estado
  CHECK (justificante_estado IS NULL OR justificante_estado IN ('pendiente', 'entregado'));
