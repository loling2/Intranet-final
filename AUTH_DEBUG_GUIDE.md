# Quick Reference: Login & Auth Debugging

## Blank Screen Login Issue - Resolution Steps

If users see a blank screen after login attempt:

### Step 1: Check Browser Console for Errors
1. Open browser DevTools: `F12`
2. Go to **Console** tab
3. Look for red error messages containing "Login"
4. Report the exact error message

### Step 2: Common Error Messages & Solutions

| Message | Cause | Solution |
|---------|-------|----------|
| `Login fetch error: ...` | Network unreachable to edge function | Check internet connection, verify SUPABASE_URL |
| `Invalid JSON response from login` | Edge function returned non-JSON | Check `admin-login` function logs |
| `Credenciales incorrectas` | Wrong email or password | Verify credentials, check user exists in auth.users |
| `Missing tokens in login response` | Edge function didn't return tokens | Check edge function implementation |
| `Session setup error: ...` | Supabase client error | Check console for full error, verify anon key |
| `Profile parsing error: ...` | User record corrupted | Proceed with default role, verify database |
| `Error de conexión...` | Network failure during fetch | Retry, check network connection |
| `Error al crear sesión...` | Session creation failed | Try again, check browser local storage |

### Step 3: Enable Debug Logging

Add this to `LoginPage.tsx` to increase verbosity:

```typescript
// Inside handleLogin function, after line 20:
console.log('===== LOGIN DEBUG =====');
console.log('Email:', email.trim().toLowerCase());
console.log('Supabase URL:', supabaseUrl);
```

### Step 4: Check Backend

#### Via Supabase Dashboard:
1. Go to **Authentication** → **Users**
2. Verify user exists with correct email
3. Verify user status is "Confirmed"

#### Via SQL:
```sql
-- Check user in auth.users
SELECT id, email, confirmed_at FROM auth.users WHERE email = 'user@empresa.com';

-- Check user_profile exists
SELECT id, nombre, email, role, activo FROM user_profiles WHERE email = 'user@empresa.com';

-- Check empleado exists (should auto-create on user_profile insert)
SELECT id, user_id, nombre, email, activo FROM empleados WHERE email = 'user@empresa.com';
```

---

## Authentication Flow Diagram

```
1. User enters credentials (email + password)
           ↓
2. LoginPage calls /functions/v1/admin-login
           ↓
3. admin-login:
   a) Calls check_user_password() RPC
   b) Validates password against bcrypt hash
   c) Calls /auth/v1/token to generate JWT tokens
   d) Fetches user_profiles record
   e) Returns { userId, email, profile, access_token, refresh_token }
           ↓
4. LoginPage:
   a) Parses JSON response
   b) Validates tokens exist
   c) Calls supabase.auth.setSession() ← Establishes RLS context
   d) Parses profile (role, societies)
   e) Determines which panel to show (admin/rrhh/dashboard/etc)
   f) Renders appropriate panel
           ↓
5. Panel loads with RLS-filtered data (only user's authorized data)
```

---

## RLS Policy Verification

### Test Employee Self-Access

```sql
-- Login as employee with ID: 00000000-0000-0000-0000-000000000001
SET request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000001';
SET role TO authenticated;

-- Should see ONLY own record
SELECT id, nombre, email FROM empleados;

-- Expected: 1 row (own record)
```

### Test Admin Full Access

```sql
-- Login as admin with ID: 00000000-0000-0000-0000-000000000099
SET request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000099';
SET role TO authenticated;

-- Should see ALL records
SELECT COUNT(*) FROM empleados;

-- Expected: many rows (all accessible)
```

---

## Trigger Verification

### Test Auto-Create Employee Record

```sql
-- Insert new user_profile
INSERT INTO user_profiles (
  id,
  nombre,
  email,
  role,
  activo,
  societies
) VALUES (
  gen_random_uuid(),
  'Test User',
  'test123@empresa.com',
  'employee',
  true,
  ARRAY['<society-uuid>']  -- Get from: SELECT id FROM sociedades LIMIT 1
)
RETURNING id AS user_id;

-- Copy the returned user_id, then verify empleado was auto-created:
SELECT * FROM empleados WHERE user_id = '<user_id>';

-- Expected: 1 row with auto-populated fields
```

---

## Cascading Delete Verification

```sql
-- Get any user_profile ID
SELECT id FROM user_profiles LIMIT 1 \gset user_id

-- Count empleado records for this user before delete
SELECT COUNT(*) FROM empleados WHERE user_id = :'user_id' AS before_delete;

-- Delete the user_profile
DELETE FROM user_profiles WHERE id = :'user_id';

-- Count empleado records after delete (should be 0)
SELECT COUNT(*) FROM empleados WHERE user_id = :'user_id' AS after_delete;

-- Expected: 
--   before_delete: 1
--   after_delete: 0 (cascaded delete worked)
```

---

## Policy Verification

### Check Active Policies

```sql
-- List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('empleados', 'user_profiles', 'sociedades')
ORDER BY tablename, policyname;
```

### Check Policy Effectiveness

```sql
-- As employee, try to see all employees (should fail)
SET request.jwt.claim.sub TO 'employee-user-id';
SET role TO authenticated;

SELECT COUNT(*) FROM empleados;
-- Expected: 1 (only own record due to RLS)

-- As admin, try to see all employees (should succeed)
SET request.jwt.claim.sub TO 'admin-user-id';
SET role TO authenticated;

SELECT COUNT(*) FROM empleados;
-- Expected: many rows (all accessible)
```

---

## Edge Function Debugging

### Check admin-login Logs

In Supabase Dashboard → **Edge Functions** → **admin-login** → **Logs**:

Look for entries showing:
- Input parameters: `{ email, password }`
- Password verification result: `userId: ...` or `error: Credenciales incorrectas`
- Token generation: `access_token: ...` and `refresh_token: ...`
- Profile fetch: `profile: { role, societies, ... }`

### Common Edge Function Issues

| Issue | Log Evidence | Solution |
|-------|---|---|
| Password check fails | `pwError` in logs or `!resolvedId` | Verify password is hashed with bcrypt-10, check `check_user_password()` function |
| Token generation fails | `!signInResp.ok` in logs | Check edge function has SUPABASE_ANON_KEY env var, verify credentials |
| Profile fetch returns null | Profile is `null` in response | Verify user_profiles record exists, check RLS policies on user_profiles |

---

## Network & CORS Debugging

### Browser Network Tab

1. Open DevTools → **Network** tab
2. Attempt login
3. Find POST request to `/functions/v1/admin-login`
4. Check:
   - **Status**: Should be `200` (or `401` for bad credentials)
   - **Response Headers**: Look for `Access-Control-Allow-Origin: *`
   - **Response Body**: Should contain `{ userId, email, profile, access_token, refresh_token }`

### CORS Issues

If you see `CORS error` in console:

1. Verify edge function has correct CORS headers:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

2. Verify OPTIONS request handling:
```typescript
if (req.method === "OPTIONS") {
  return new Response(null, { status: 200, headers: corsHeaders });
}
```

---

## Performance Optimization

### Check Slow Queries

```sql
-- Identify slow queries in admin-login flow
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%user_profiles%' OR query LIKE '%empleados%'
ORDER BY mean_time DESC
LIMIT 10;
```

### Add Missing Indexes

```sql
-- Verify indexes exist on frequently queried columns
SELECT indexname FROM pg_indexes WHERE tablename = 'empleados' ORDER BY indexname;

-- Expected indexes:
-- idx_empleados_id_sociedad
-- idx_empleados_user_id
-- idx_empleados_dni

-- If missing, add them:
CREATE INDEX IF NOT EXISTS idx_empleados_user_id ON empleados(user_id);
```

---

## Rollback Instructions

If you need to revert the changes:

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS trg_sync_auth_user_to_empleado ON user_profiles;
DROP FUNCTION IF EXISTS sync_auth_user_to_empleado();

-- Revert FK to SET NULL
ALTER TABLE empleados DROP CONSTRAINT IF EXISTS empleados_user_id_fkey;
ALTER TABLE empleados
  ADD CONSTRAINT empleados_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES user_profiles(id)
  ON DELETE SET NULL;

-- Remove new helper functions
DROP FUNCTION IF EXISTS is_rrhh();
DROP FUNCTION IF EXISTS is_employee_activo();
DROP FUNCTION IF EXISTS current_user_employee_id();
```

Then revert the LoginPage.tsx changes to use the old error handling.

---

## Support Contacts

- **Database Issues**: Check Supabase status page → Dashboard Logs
- **Auth Issues**: Supabase → Authentication → Users
- **Edge Function Logs**: Supabase → Edge Functions → Function Name → Logs
- **Application Errors**: Browser DevTools Console (F12)
