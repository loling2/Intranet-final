-- Add explicit horas_nocturnas field to sustituciones
ALTER TABLE sustituciones
  ADD COLUMN IF NOT EXISTS horas_nocturnas numeric DEFAULT 0;
