-- Drop existing constraint (uses pdf_origen, which is wrong)
ALTER TABLE nominas DROP CONSTRAINT IF EXISTS nominas_unique_per_period;

-- Recreate with society_id, dni, anio, mes, sociedad_nombre
ALTER TABLE nominas ADD CONSTRAINT nominas_unique_per_period
  UNIQUE (society_id, dni, anio, mes, sociedad_nombre);
