/*
# Work Logs and Time Incidents

## Purpose
Creates two new tables to support structured time-tracking with full audit trail:
1. `work_logs` — structured clock-in/out records with break time, metadata, and audit columns.
2. `time_incidents` — a secondary table for employee change requests (forgotten clock-in, medical appointment, etc.) linked to work_logs, with a PENDING/APROVED/REJECTED workflow.

## New Tables

### work_logs
| Column        | Type        | Description                                         |
|---------------|-------------|-----------------------------------------------------|
| id            | UUID PK     | Primary key                                         |
| user_id       | UUID        | References auth.users                               |
| start_time    | TIMESTAMPTZ | Exact start time (UTC)                              |
| end_time      | TIMESTAMPTZ | Exact end time (UTC), nullable while shift is open  |
| break_time    | INT         | Break duration in minutes (default 0)               |
| log_date      | DATE        | Natural day for quick queries                       |
| is_extra      | BOOLEAN     | True if shift exceeds normal hours                  |
| metadata      | JSONB       | Optional: IP, device, location                      |
| modified_by   | UUID        | Who last modified the record (audit trail)          |
| created_at    | TIMESTAMPTZ | Record creation timestamp                           |
| updated_at    | TIMESTAMPTZ | Record last-update timestamp                        |

### time_incidents
| Column         | Type        | Description                                              |
|----------------|-------------|----------------------------------------------------------|
| id             | UUID PK     | Primary key                                              |
| user_id        | UUID        | Who makes the request                                    |
| work_log_id    | UUID FK     | Related work_log (nullable if creating a missing log)   |
| reason         | TEXT        | Reason: "olvido", "cita médica", etc.                   |
| proposed_start | TIMESTAMPTZ | Suggested start time                                     |
| proposed_end   | TIMESTAMPTZ | Suggested end time                                       |
| status         | TEXT        | PENDING, APPROVED, REJECTED (default PENDING)           |
| created_at     | TIMESTAMPTZ | When the user submitted the request                      |

## Security
- RLS enabled on both tables.
- work_logs: authenticated users can CRUD their own rows; admins/rrhh/supervisor can SELECT all.
- time_incidents: authenticated users can INSERT/SELECT their own; admins/rrhh/supervisor can SELECT/UPDATE all.

## Important Notes
1. `work_logs.user_id` defaults to `auth.uid()` so inserts that omit it still satisfy RLS.
2. `work_logs.modified_by` defaults to `auth.uid()` on insert; updated by the approver when an incident is approved.
3. `time_incidents.work_log_id` is nullable to support "I forgot to clock in entirely" scenarios.
4. An index on `(user_id, log_date)` enables fast per-day queries.
5. An index on `time_incidents(status)` enables fast pending-list queries.
*/

-- ── work_logs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ,
  break_time  INT NOT NULL DEFAULT 0,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  is_extra    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB,
  modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own work_logs
DROP POLICY IF EXISTS "select_own_work_logs" ON work_logs;
CREATE POLICY "select_own_work_logs"
  ON work_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins/RRHH/supervisor can see all work_logs
DROP POLICY IF EXISTS "select_all_work_logs_admin" ON work_logs;
CREATE POLICY "select_all_work_logs_admin"
  ON work_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'supervisor')
    )
  );

-- Users can insert their own work_logs
DROP POLICY IF EXISTS "insert_own_work_logs" ON work_logs;
CREATE POLICY "insert_own_work_logs"
  ON work_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own work_logs (e.g. closing an open shift)
DROP POLICY IF EXISTS "update_own_work_logs" ON work_logs;
CREATE POLICY "update_own_work_logs"
  ON work_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins/RRHH can update any work_log (for incident approvals)
DROP POLICY IF EXISTS "update_all_work_logs_admin" ON work_logs;
CREATE POLICY "update_all_work_logs_admin"
  ON work_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

-- Users can delete their own (rare, but allowed for same-day corrections)
DROP POLICY IF EXISTS "delete_own_work_logs" ON work_logs;
CREATE POLICY "delete_own_work_logs"
  ON work_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON work_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_logs_log_date ON work_logs(log_date DESC);

-- ── time_incidents ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_incidents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  work_log_id   UUID REFERENCES work_logs(id) ON DELETE SET NULL,
  reason         TEXT NOT NULL,
  proposed_start TIMESTAMPTZ,
  proposed_end   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE time_incidents ENABLE ROW LEVEL SECURITY;

-- Users can see their own incidents
DROP POLICY IF EXISTS "select_own_time_incidents" ON time_incidents;
CREATE POLICY "select_own_time_incidents"
  ON time_incidents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins/RRHH/supervisor can see all incidents
DROP POLICY IF EXISTS "select_all_time_incidents_admin" ON time_incidents;
CREATE POLICY "select_all_time_incidents_admin"
  ON time_incidents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'supervisor')
    )
  );

-- Users can insert their own incidents
DROP POLICY IF EXISTS "insert_own_time_incidents" ON time_incidents;
CREATE POLICY "insert_own_time_incidents"
  ON time_incidents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins/RRHH can update incident status (approve/reject)
DROP POLICY IF EXISTS "update_all_time_incidents_admin" ON time_incidents;
CREATE POLICY "update_all_time_incidents_admin"
  ON time_incidents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

CREATE INDEX IF NOT EXISTS idx_time_incidents_status ON time_incidents(status);
CREATE INDEX IF NOT EXISTS idx_time_incidents_user ON time_incidents(user_id);
