/*
  # Make centros.id_sociedad nullable

  ## Changes
  - `centros` table: `id_sociedad` column made nullable so work centers can
    exist without being assigned to a society yet (unassigned pool).

  ## Reason
  The UI needs to support creating centros de trabajo first and then assigning
  them to a society later. Previously the column had a NOT NULL constraint which
  prevented this workflow.
*/

ALTER TABLE centros ALTER COLUMN id_sociedad DROP NOT NULL;
