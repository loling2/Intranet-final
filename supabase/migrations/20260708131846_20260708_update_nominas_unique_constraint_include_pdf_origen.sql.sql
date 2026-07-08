-- Drop the existing unique constraint and recreate with pdf_origen
-- This allows the same DNI to have multiple nominas from different source PDFs
ALTER TABLE nominas DROP CONSTRAINT IF EXISTS nominas_unique_per_period;

-- New constraint: same employee+period can have multiple records if from different source PDFs
-- This preserves records when the same DNI appears in multiple uploaded files
ALTER TABLE nominas ADD CONSTRAINT nominas_unique_per_period
  UNIQUE (society_id, dni, anio, mes, pdf_origen);