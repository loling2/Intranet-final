-- Drop old unique constraint and recreate including sociedad_nombre
-- so that two nominas of the same employee/period from different companies can coexist
ALTER TABLE nominas DROP CONSTRAINT IF EXISTS nominas_unique_per_period;
ALTER TABLE nominas ADD CONSTRAINT nominas_unique_per_period
  UNIQUE (society_id, dni, anio, mes, sociedad_nombre);
