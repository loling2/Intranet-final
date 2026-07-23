/*
# Create tab_last_seen table for per-user tab badge counts

1. New Tables
- `tab_last_seen` — stores the last time each user viewed each Dashboard tab.
  - `user_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the employee.
  - `tab_id` (text, NOT NULL) — the tab identifier (e.g. 'nominas', 'calidad', 'prevencion', 'misdocumentos', 'incidencias', 'fichajes').
  - `last_seen_at` (timestamptz, NOT NULL, DEFAULT now()) — timestamp of last view.
  - Primary key: (user_id, tab_id) — one row per user per tab.
2. Security
- Enable RLS on `tab_last_seen`.
- Owner-scoped CRUD: each authenticated user can only read/insert/update their own rows.
3. Notes
- The frontend uses this to compute badge counts: for each tab, count items newer than `last_seen_at`.
- When a user clicks a tab, the frontend upserts `last_seen_at = now()`, which clears the badge.
*/

CREATE TABLE IF NOT EXISTS tab_last_seen (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tab_id text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tab_id)
);

ALTER TABLE tab_last_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tab_last_seen" ON tab_last_seen;
CREATE POLICY "select_own_tab_last_seen" ON tab_last_seen
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tab_last_seen" ON tab_last_seen;
CREATE POLICY "insert_own_tab_last_seen" ON tab_last_seen
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tab_last_seen" ON tab_last_seen;
CREATE POLICY "update_own_tab_last_seen" ON tab_last_seen
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tab_last_seen" ON tab_last_seen;
CREATE POLICY "delete_own_tab_last_seen" ON tab_last_seen
  FOR DELETE TO authenticated USING (auth.uid() = user_id);