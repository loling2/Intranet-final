ALTER TABLE sustituciones
  ADD COLUMN IF NOT EXISTS horas_liquidadas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_descontados boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS descripcion_descuento text;
