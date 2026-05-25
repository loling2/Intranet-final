/*
  # Create password verification function

  Creates a secure SQL function that verifies a user's password
  against the stored bcrypt hash in auth.users.
  Used by the admin-login edge function as a fallback when
  Supabase Auth's email provider is misconfigured.
*/

CREATE OR REPLACE FUNCTION public.check_user_password(p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(p_email)
    AND encrypted_password = crypt(p_password, encrypted_password)
    AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL
    AND banned_until IS NULL;

  RETURN v_user_id;
END;
$$;

-- Only service role can call this
REVOKE ALL ON FUNCTION public.check_user_password(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_user_password(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.check_user_password(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_password(text, text) TO service_role;
