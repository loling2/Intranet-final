import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify caller is admin or rrhh via their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller role
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } }
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

    const { action, userId, password, email, role, pin, nombre, societies } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: "Faltan parametros" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a new auth user + user_profile from an existing empleado
    if (action === "create_user") {
      if (!email || !nombre) {
        return new Response(JSON.stringify({ error: "Email y nombre son obligatorios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tempPassword = crypto.randomUUID().replace(/-/g, "") + "Aa1!";
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      const uid = newUser.user.id;
      const { error: profileErr } = await supabaseAdmin.from("user_profiles").insert({
        id: uid,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        role: role ?? "employee",
        activo: true,
        societies: societies ?? [],
      });
      if (profileErr) throw profileErr;
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
      // Only admin can assign admin role
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
