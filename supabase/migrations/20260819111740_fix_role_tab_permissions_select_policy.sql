/*
# Fix role_tab_permissions SELECT policy

## Problem
The SELECT policy on `role_tab_permissions` was restricted to admins only
(`is_admin()`). Non-admin roles (supervisor, prevencion, etc.) could not read
their own tab permissions, so the frontend received zero rows and fell back to
a hardcoded tab list that ignored the database configuration.

## Changes
1. Drop the admin-only SELECT policy.
2. Create a new SELECT policy allowing all authenticated users to read the
   table. This table stores only role→tab configuration (not sensitive user
   data), so every authenticated user needs to read their own role's permissions
   to render the correct set of tabs.
3. Write policies (INSERT/UPDATE/DELETE) remain admin-only — unchanged.

## Security
- SELECT: any authenticated user can read all rows (configuration data only).
- INSERT/UPDATE/DELETE: still restricted to admins via existing policies.
*/

DROP POLICY IF EXISTS "admin_select_role_tab_permissions" ON role_tab_permissions;

CREATE POLICY "authenticated_select_role_tab_permissions"
  ON role_tab_permissions FOR SELECT
  TO authenticated
  USING (true);
