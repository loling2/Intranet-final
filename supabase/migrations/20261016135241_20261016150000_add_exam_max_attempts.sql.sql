/*
# Add configurable maximum exam attempts

1. Modified Tables
- `examenes.max_intentos`: maximum number of attempts allowed for each exam. Existing exams receive 1 attempt by default.

2. Data Safety
- No rows are deleted or changed except for the new column default.
- Existing attempt counters in `examen_asignaciones.intentos` remain intact.

3. Security
- The new column inherits the existing RLS policies on `examenes`.
- Only the existing staff roles can create or edit exam configuration.

4. Important Notes
- A value of 1 means the employee can submit the exam once.
- The application will use this value when deciding whether another attempt can be started.
*/

ALTER TABLE public.examenes
  ADD COLUMN IF NOT EXISTS max_intentos integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'examenes_max_intentos_check'
  ) THEN
    ALTER TABLE public.examenes
      ADD CONSTRAINT examenes_max_intentos_check CHECK (max_intentos BETWEEN 1 AND 20);
  END IF;
END $$;
