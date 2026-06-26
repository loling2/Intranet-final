-- Add company name field extracted from PDF to nominas
ALTER TABLE nominas ADD COLUMN IF NOT EXISTS sociedad_nombre text NOT NULL DEFAULT '';
