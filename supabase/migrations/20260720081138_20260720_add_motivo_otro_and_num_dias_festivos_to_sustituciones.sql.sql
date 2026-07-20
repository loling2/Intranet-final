ALTER TABLE sustituciones
  ADD COLUMN IF NOT EXISTS motivo_otro text,
  ADD COLUMN IF NOT EXISTS num_dias_festivos integer DEFAULT 0;