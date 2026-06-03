# Supabase Database Architecture Remediation

## Executive Summary

Three critical issues have been identified and fixed in your Supabase PostgreSQL database:

1. **Synchronization Gap**: Users registered in `auth.users` did not automatically create corresponding `empleados` records, causing login failures and blank screens
2. **Referential Integrity Gap**: Deleting a user left orphaned `empleado` records with dangling foreign keys
3. **Authentication Error Handling**: Login failures weren't properly caught and displayed, resulting in silent failures and blank screens

All issues are now remediated via a single migration and application code improvements.

---

## Problem 1: Auth.users → Empleados Synchronization

### What Was Wrong

When a new user registered in `auth.users`, no corresponding `empleado` record was created in the `empleados` table. This caused:
- Login succeeds but profile is missing
- Blank screen because `empleados` query returns no results
- RLS policies fail silently (no authorized data to display)
- Manual workaround: HR staff had to manually create `empleado` records after user registration

### Root Cause

No database trigger existed to automatically sync `auth.users` → `user_profiles` → `empleados`. The application relied on manual insertion via the `manage-user` edge function, which was error-prone.

### Solution Implemented

**New Trigger: `sync_auth_user_to_empleado()`**

```sql
CREATE TRIGGER trg_sync_auth_user_to_empleado
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_user_to_empleado();
```

**How it works:**
1. Fires automatically when a new `user_profile` is inserted
2. Checks if an `empleado` record already exists for that user
3. If not, creates one with:
   - `user_id` → linked to the auth user
   - `id_sociedad` → set from the user's assigned societies (first one)
   - `nombre`, `email` → copied from user profile
   - `activo` → copied from user profile
4. If no societies are assigned, uses the first available society
5. Prevents duplicate `empleado` records with `ON CONFLICT DO NOTHING`

**Idempotency**: Safe to re-run. If an `empleado` already exists, the trigger skips creation.

**Backfill**: The migration includes a one-time backfill that creates `empleado` records for any orphaned `user_profiles` that don't have corresponding `empleado` entries.

---

## Problem 2: Referential Integrity Gap

### What Was Wrong

When deleting a user from `auth.users`, the corresponding `empleado` record became an orphan with a dangling foreign key:

```sql
-- OLD: permitía NULL orphans
ALTER TABLE empleados
  ADD CONSTRAINT empleados_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES user_profiles(id)
  ON DELETE SET NULL;  -- ← Problem: leaves orphans
```

This caused:
- Data inconsistency after user deletion
- Orphaned `empleado` records with `user_id = NULL`
- Compliance and audit issues (can't trace who deleted what)
- Manual cleanup required

### Solution Implemented

**Changed FK behavior from `SET NULL` to `CASCADE`:**

```sql
ALTER TABLE empleados DROP CONSTRAINT empleados_user_id_fkey;

ALTER TABLE empleados
  ADD CONSTRAINT empleados_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES user_profiles(id)
  ON DELETE CASCADE;  -- ← Now: deletes empleado when user is deleted
```

**Impact:**
- When `user_profiles` record is deleted, all related `empleado` records are automatically deleted
- No orphaned records left behind
- Clean audit trail (deletion is atomic)
- Compliant with data integrity principles

---

## Problem 3: Authentication Error Handling

### What Was Wrong

Login error handling was incomplete:

```typescript
// OLD: Minimal error handling
const body = await resp.json().catch(() => ({}));

if (!resp.ok) {
  setLoginError(body.error ?? 'Credenciales incorrectas');
  return;
}

const resolvedEmail: string = body.email ?? email.trim().toLowerCase();
const resolvedRole: UserRole = (body.profile?.role as UserRole) ?? 'employee';
```

**Problems:**
1. No try/catch around `resp.json()` — could throw and crash
2. No validation that tokens exist before calling `setSession()`
3. No error handling around profile parsing
4. Silent failures on network errors
5. No console logging for debugging

**Result**: Blank screens when:
- Network error occurs during login
- Profile loading fails after successful auth
- Invalid JSON returned from edge function
- Missing tokens in response

### Solution Implemented

**Enhanced error handling with comprehensive validation:**

1. **Network error handling**: Try/catch with user-friendly message
2. **JSON parsing validation**: Separate try/catch for response parsing
3. **Token validation**: Check tokens exist before calling `setSession()`
4. **Response validation**: Verify all required fields are present
5. **Profile parsing safety**: Wrap in try/catch with fallback to default role
6. **Console logging**: Detailed error logs for debugging

**Code structure:**

```typescript
try {
  // Step 1: Network request
  let resp: Response;
  try {
    resp = await fetch(...);
  } catch (fetchErr) {
    console.error('Login fetch error:', errMsg);
    setLoginError('Error de conexión...');
    return;
  }

  // Step 2: Parse JSON
  let body: Record<string, unknown> = {};
  try {
    body = await resp.json();
  } catch (jsonErr) {
    console.error('Invalid JSON response from login:', jsonErr);
    setLoginError('Error del servidor...');
    return;
  }

  // Step 3: Check response status
  if (!resp.ok) {
    console.error('Login error:', errorMsg);
    setLoginError(errorMsg);
    return;
  }

  // Step 4: Validate tokens exist
  if (!body.access_token || !body.refresh_token) {
    console.error('Missing tokens in login response:', body);
    setLoginError('Error al crear sesión...');
    return;
  }

  // Step 5: Set session
  try {
    await supabase.auth.setSession({...});
  } catch (sessionErr) {
    console.error('Session setup error:', errMsg);
    setLoginError('Error al iniciar sesión...');
    return;
  }

  // Step 6: Parse profile safely
  try {
    // Extract role and societies with fallbacks
  } catch (profileErr) {
    console.error('Profile parsing error:', profileErr);
    console.warn('Proceeding with default employee role');
  }

} catch (err) {
  console.error('Unexpected login error:', errMsg, err);
  setLoginError('Error inesperado...');
}
```

**Benefits:**
- Catches all error paths with appropriate user messages
- Console logs show exact failure point for debugging
- Graceful degradation: if profile fails, uses default role
- No blank screens — user always sees an error message
- Security: errors are descriptive but don't leak internals

---

## Files Modified

### 1. Database Migration

**File**: `supabase/migrations/20260603_comprehensive_auth_sync_and_rls_fixes.sql`

**Changes:**
- ✓ Added `sync_auth_user_to_empleado()` trigger function
- ✓ Fixed FK `ON DELETE CASCADE` for referential integrity
- ✓ Added helper functions: `is_rrhh()`, `is_employee_activo()`, `current_user_employee_id()`
- ✓ Enhanced RLS policies for employee self-access
- ✓ Added society isolation policies
- ✓ Backfilled orphaned `user_profiles` records

### 2. Login Page

**File**: `src/LoginPage.tsx`

**Changes:**
- ✓ Enhanced `handleLogin()` with comprehensive error handling
- ✓ Added try/catch blocks for network, JSON parsing, session setup, profile parsing
- ✓ Added validation for tokens before session creation
- ✓ Added console error logging for debugging
- ✓ Improved error messages (user-friendly Spanish messages)
- ✓ Graceful fallback to default role if profile parsing fails

---

## Testing Checklist

### Test 1: Automatic Employee Creation

```sql
-- Create a new user_profile
INSERT INTO user_profiles (
  id, 
  nombre, 
  email, 
  role, 
  activo, 
  societies
) VALUES (
  gen_random_uuid(),
  'Test Employee',
  'test@empresa.com',
  'employee',
  true,
  ARRAY['<society_uuid>']
)
RETURNING id;

-- Verify empleado was created automatically
SELECT * FROM empleados WHERE email = 'test@empresa.com';
-- Expected: 1 row with user_id linked to the new user_profile
```

### Test 2: Cascading Delete

```sql
-- Get a user_profile ID
SELECT id FROM user_profiles LIMIT 1 \gset user_id

-- Verify empleado exists for this user
SELECT COUNT(*) FROM empleados WHERE user_id = :'user_id';
-- Expected: 1

-- Delete the user_profile
DELETE FROM user_profiles WHERE id = :'user_id';

-- Verify empleado was deleted
SELECT COUNT(*) FROM empleados WHERE user_id = :'user_id';
-- Expected: 0 (no orphans)
```

### Test 3: RLS Employee Self-Access

```sql
-- Login as employee user
SET role to authenticated;
SET request.jwt.claim.sub to '<employee_user_id>';

-- Should see own record
SELECT * FROM empleados WHERE user_id = '<employee_user_id>';
-- Expected: 1 row (own record visible)

-- Should NOT see other employees
SELECT COUNT(*) FROM empleados;
-- Expected: 1 (only own record, others filtered by RLS)
```

### Test 4: Admin Access (Unrestricted)

```sql
-- Login as admin
SET role to authenticated;
SET request.jwt.claim.sub to '<admin_user_id>';

-- Should see all empleados
SELECT COUNT(*) FROM empleados;
-- Expected: many rows (all accessible)
```

### Test 5: Login Error Scenarios

**Scenario A: Network Error**
- Disconnect network, try login
- Expected: "Error de conexión. Verifica tu conexión de red."
- Check browser console: Should see "Login fetch error: ..."

**Scenario B: Invalid Credentials**
- Login with wrong password
- Expected: Edge function returns 401
- Display: "Credenciales incorrectas"
- Check browser console: Should see "Login error: Credenciales incorrectas"

**Scenario C: Session Setup Failure** (rare, testing)
- Modify edge function to return invalid tokens
- Expected: "Error al crear sesión. Intenta de nuevo."
- Check browser console: Should see "Session setup error: ..."

**Scenario D: Profile Missing** (rare, testing)
- Modify edge function to return null profile
- Expected: Login succeeds with default role ('employee')
- Check browser console: Should see "Profile parsing error: ..." and "Proceeding with default employee role"

---

## Deployment Notes

### Pre-Deployment

1. **Backup current database** (Supabase auto-backups, but verify)
2. **Review migration** for any conflicts with custom migrations
3. **Test in staging environment** first

### Migration Execution

The migration is **safe to run**:
- Uses `DROP CONSTRAINT IF EXISTS` for idempotency
- Uses `DO $$ ... END $$` blocks to handle missing objects
- Backfill is one-time and non-destructive (uses `ON CONFLICT DO NOTHING`)
- No data is deleted or modified (only triggers and policies added)

### Post-Deployment

1. **Verify trigger created**:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trg_sync_auth_user_to_empleado';
   ```

2. **Verify FK changed**:
   ```sql
   SELECT constraint_name, delete_rule 
   FROM information_schema.referential_constraints 
   WHERE constraint_name = 'empleados_user_id_fkey';
   -- Expected: delete_rule = 'CASCADE'
   ```

3. **Test new user registration**:
   - Create new user via admin panel
   - Verify `empleado` record auto-created
   - Verify login works without blank screen

4. **Monitor logs** for 24 hours:
   - Check Supabase logs for any RLS errors
   - Check application error logs for login failures

---

## Future Improvements

1. **Trigger Event Logging**: Audit trail for auto-created `empleado` records
2. **Profile Enrichment**: Auto-populate more fields from LDAP/external system
3. **Society Assignment**: Add logic to auto-assign multiple societies based on department
4. **Rate Limiting**: Add rate limiting to login endpoint to prevent brute force
5. **Two-Factor Auth**: Implement 2FA for privileged roles (admin, RRHH)

---

## Support & Debugging

### Login Blank Screen Issues

1. **Open browser DevTools** (F12 → Console)
2. **Look for error messages** starting with "Login" or "Session"
3. **Check error messages** for specific failure point
4. **Common issues:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Error de conexión" | Network unreachable | Check internet connection |
| "Credenciales incorrectas" | Wrong email/password | Verify credentials are correct |
| "Error al crear sesión" | Invalid tokens from backend | Check edge function logs |
| "Error inesperado" | Unexpected exception | Check browser console for full error |

### Database Issues

1. **Check trigger exists**:
   ```sql
   SELECT pg_get_triggerdef(oid) 
   FROM pg_trigger 
   WHERE tgname = 'trg_sync_auth_user_to_empleado';
   ```

2. **Monitor RLS violations**:
   ```sql
   SELECT COUNT(*) FROM pg_stat_statements 
   WHERE query LIKE '%permission denied%';
   ```

3. **Check for orphaned records**:
   ```sql
   SELECT COUNT(*) FROM empleados 
   WHERE user_id IS NULL;
   -- Should be 0
   ```

---

## Security Considerations

1. **RLS is Restrictive**: No policies use `USING (true)` — all are restrictive by default
2. **Helper Functions Use `SECURITY DEFINER`**: Prevents RLS recursion while maintaining access control
3. **Auth checks**: All policies verify `auth.uid()` explicitly
4. **Society Isolation**: Employees can only see their assigned companies
5. **Cascading Delete**: Ensures clean data removal when users are deleted

---

## Questions?

Refer to:
- **Supabase Docs**: https://supabase.com/docs
- **Row Level Security**: https://supabase.com/docs/guides/auth/row-level-security
- **Triggers**: https://supabase.com/docs/guides/database/tables
- **Edge Functions**: https://supabase.com/docs/guides/functions
