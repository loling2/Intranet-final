import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CREATE_AUTH_USER_SQL = `
CREATE OR REPLACE FUNCTION public.create_auth_user(
  p_email text,
  p_password text,
  p_nombre text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid uuid;
  v_now timestamptz := now();
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users SET
      encrypted_password = crypt(p_password, gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, v_now),
      updated_at = v_now,
      raw_user_meta_data = jsonb_build_object('nombre', p_nombre)
    WHERE id = v_uid;
    RETURN v_uid;
  END IF;

  v_uid := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    aud, role, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf', 10)),
    v_now,
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nombre', p_nombre),
    v_now, v_now, '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, provider_id, user_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_uid::text,
    v_uid,
    'email',
    jsonb_build_object('sub', v_uid::text, 'email', lower(trim(p_email)), 'email_verified', true),
    v_now, v_now, v_now
  );

  RETURN v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_auth_user(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_auth_user(text, text, text) TO service_role;
`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (!callerProfile || !["admin", "rrhh"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Permiso denegado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, userId, password, email, role, pin, nombre, societies } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Faltan parametros" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // One-time bootstrap: creates create_auth_user SQL function via direct DB connection
    if (action === "bootstrap_rpc") {
      if (!dbUrl) {
        return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not available" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { Client } = await import("npm:pg@8.11.3");
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      try {
        await client.query(CREATE_AUTH_USER_SQL);
      } finally {
        await client.end();
      }
      return new Response(
        JSON.stringify({ ok: true, message: "create_auth_user function created successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a new auth user + user_profile
    if (action === "create_user") {
      if (!email || !nombre) {
        return new Response(JSON.stringify({ error: "Email y nombre son obligatorios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const tempPassword = crypto.randomUUID().replace(/-/g, "") + "Aa1!";

      let uid: string;

      // Try SECURITY DEFINER RPC first (bypasses broken auth API on Supabase Pro)
      const { data: rpcUid, error: rpcErr } = await supabaseAdmin.rpc("create_auth_user", {
        p_email: normalizedEmail,
        p_password: tempPassword,
        p_nombre: nombre.trim(),
      });

      if (!rpcErr && rpcUid) {
        uid = rpcUid as string;
      } else {
        // RPC not yet bootstrapped — fall back to auth.admin.createUser
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = existingUsers?.users?.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );

        if (existingAuthUser) {
          uid = existingAuthUser.id;
          await supabaseAdmin.auth.admin.updateUserById(uid, {
            password: tempPassword,
            email_confirm: true,
          });
        } else {
          const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { nombre: nombre.trim() },
          });
          if (createErr) {
            return new Response(
              JSON.stringify({ error: `Error al crear usuario en Auth: ${createErr.message}` }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          uid = newUser.user.id;
        }
      }

      // Upsert user_profiles
      const { error: profileErr } = await supabaseAdmin.from("user_profiles").upsert({
        id: uid,
        nombre: nombre.trim(),
        email: normalizedEmail,
        role: role ?? "employee",
        activo: true,
        societies: societies ?? [],
      }, { onConflict: "id" });

      if (profileErr) {
        return new Response(
          JSON.stringify({ error: `Error al crear perfil: ${profileErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ ok: true, userId: uid, tempPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Falta userId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_password") {
      if (!password || password.length < 8) {
        return new Response(JSON.stringify({ error: "La contrasena debe tener al menos 8 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_email") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email requerido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
      if (authError) throw authError;
      const { error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .update({ email })
        .eq("id", userId);
      if (profileError) throw profileError;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_role") {
      if (!role) {
        return new Response(JSON.stringify({ error: "Rol requerido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (role === "admin" && callerProfile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Solo el administrador puede asignar el rol admin" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin
        .from("user_profiles")
        .update({ role })
        .eq("id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_pin") {
      const pinValue = pin ?? Math.floor(1000 + Math.random() * 9000).toString();
      const { error } = await supabaseAdmin
        .from("user_profiles")
        .update({ pin: pinValue })
        .eq("id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, pin: pinValue }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Accion desconocida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
