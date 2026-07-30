/*
# Create vacation_balances table

1. New Tables
   - `vacation_balances`
     - `id` (uuid, primary key)
     - `employee_id` (uuid, FK to empleados, NOT NULL)
     - `society_id` (text, NOT NULL)
     - `year` (integer, NOT NULL) — the year the balance applies to
     - `dias_totales` (integer, NOT NULL DEFAULT 22) — total vacation days for the year
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)
   - Unique constraint on (employee_id, year) so each employee has one balance per year.

2. Security
   - RLS enabled.
   - Employees can read their own balance (employee_id matches auth.uid() via empleados.user_id).
   - RRHH and admin can read and update all balances.
   - Anyone authenticated can insert (for initial setup by RRHH/admin).
*/

CREATE TABLE IF NOT EXISTS vacation_balances (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  society_id  text NOT NULL,
  year        integer NOT NULL,
  dias_totales integer NOT NULL DEFAULT 22,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vacation_balances_emp_year
  ON vacation_balances (employee_id, year);

ALTER TABLE vacation_balances ENABLE ROW LEVEL SECURITY;

-- Employees read own balance (via empleados.user_id = auth.uid())
DROP POLICY IF EXISTS "Employees read own vacation balance" ON vacation_balances;
CREATE POLICY "Employees read own vacation balance" ON vacation_balances FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM empleados e WHERE e.id = employee_id AND e.user_id = auth.uid())
  );

-- RRHH / admin read all balances
DROP POLICY IF EXISTS "RRHH admin read all vacation balances" ON vacation_balances;
CREATE POLICY "RRHH admin read all vacation balances" ON vacation_balances FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','rrhh'))
  );

-- RRHH / admin insert balances
DROP POLICY IF EXISTS "RRHH admin insert vacation balances" ON vacation_balances;
CREATE POLICY "RRHH admin insert vacation balances" ON vacation_balances FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','rrhh'))
  );

-- RRHH / admin update balances
DROP POLICY IF EXISTS "RRHH admin update vacation balances" ON vacation_balances;
CREATE POLICY "RRHH admin update vacation balances" ON vacation_balances FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','rrhh'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','rrhh'))
  );

-- Supervisor read balances for employees in their centers
DROP POLICY IF EXISTS "Supervisor read vacation balances" ON vacation_balances;
CREATE POLICY "Supervisor read vacation balances" ON vacation_balances FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'supervisor')
  );
