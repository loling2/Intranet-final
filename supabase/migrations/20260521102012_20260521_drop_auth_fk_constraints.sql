/*
  # Drop foreign key constraints referencing auth.users

  The app uses mock authentication (not Supabase Auth), so user IDs are
  application-managed UUIDs that don't exist in auth.users. All FK constraints
  pointing to auth.users.id cause insert/update failures.

  This migration drops those constraints while keeping the column data intact.
*/

ALTER TABLE vehicle_logs DROP CONSTRAINT IF EXISTS vehicle_logs_user_id_fkey;
ALTER TABLE vehicle_logs DROP CONSTRAINT IF EXISTS vehicle_logs_liberado_por_fkey;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_current_user_id_fkey;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_subido_por_fkey;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_usuario_destino_id_fkey;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_autor_id_fkey;

ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_subido_por_fkey;
ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_employee_id_fkey;

ALTER TABLE vacation_requests DROP CONSTRAINT IF EXISTS vacation_requests_revisado_por_fkey;
ALTER TABLE vacation_requests DROP CONSTRAINT IF EXISTS vacation_requests_employee_id_fkey;

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_invited_by_fkey;
