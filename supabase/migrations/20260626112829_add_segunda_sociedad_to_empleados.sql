-- Add optional second society to empleados
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS id_sociedad_secundaria text;
