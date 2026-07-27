/*
# Add dias_a_descontar and justificante fields to sustituciones

1. New Columns on `sustituciones`
- `dias_a_descontar` (integer, nullable, default 0) — días a descontar del balance del trabajador sustituido. Si no hay nada que descontar, se muestra vacío o "-".
- `tiene_justificante` (boolean, default false) — marca opcional (check) que indica si la sustitución tiene justificante. NO obligatorio.

2. Modified Tables
- `sustituciones` — dos columnas aditivas con defaults. Los registros existentes no se ven afectados.

3. Security
- No se modifican políticas RLS. Las políticas existentes cubren las nuevas columnas.

4. Notes
1. Columnas aditivas con defaults, seguras para re-ejecutar.
2. `tiene_justificante` es opcional (no obligatorio) por diseño.
3. `dias_a_descontar` permite null para distinguir "sin descuento" (mostrar "-") de "0".
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sustituciones' AND column_name = 'dias_a_descontar') THEN
    ALTER TABLE sustituciones ADD COLUMN dias_a_descontar integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sustituciones' AND column_name = 'tiene_justificante') THEN
    ALTER TABLE sustituciones ADD COLUMN tiene_justificante boolean DEFAULT false;
  END IF;
END $$;
