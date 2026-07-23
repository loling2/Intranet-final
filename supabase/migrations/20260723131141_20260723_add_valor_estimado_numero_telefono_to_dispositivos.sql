ALTER TABLE dispositivos
  ADD COLUMN IF NOT EXISTS valor_estimado numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS numero_telefono text DEFAULT NULL;
