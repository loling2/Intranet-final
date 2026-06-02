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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // ── create_user ───────────────────────────────────────────────────────────
    if (action === "create_user") {
      if (!email || !nombre) {
        return new Response(JSON.stringify({ error: "Email y nombre son obligatorios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const tempPassword = crypto.randomUUID().replace(/-/g, "") + "Aa1!";

      const { data: rpcUid, error: rpcErr } = await supabaseAdmin.rpc("create_auth_user", {
        p_email: normalizedEmail,
        p_password: tempPassword,
        p_nombre: nombre.trim(),
      });

      if (rpcErr || !rpcUid) {
        return new Response(
          JSON.stringify({ error: `Error al crear usuario: ${rpcErr?.message ?? "RPC returned null"}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uid = rpcUid as string;

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

    // ── bulk_import ───────────────────────────────────────────────────────────
    if (action === "bulk_import") {
      const { rows } = body as {
        rows: Array<{
          email: string;
          nombre: string;
          dni?: string;
          password: string;
          role?: string;
          societies?: string[];
        }>;
      };

      if (!rows?.length) {
        return new Response(JSON.stringify({ error: "No hay filas para importar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: Array<{ email: string; ok: boolean; error?: string; userId?: string }> = [];

      for (const row of rows) {
        try {
          const normalizedEmail = row.email.trim().toLowerCase();
          const pwd = row.password?.trim();

          if (!normalizedEmail || !row.nombre?.trim() || !pwd) {
            results.push({ email: normalizedEmail, ok: false, error: "Faltan campos obligatorios (email, nombre, contrasena)" });
            continue;
          }

          // Create auth user (or get existing)
          const { data: uid, error: rpcErr } = await supabaseAdmin.rpc("bulk_create_auth_user_simple", {
            p_email: normalizedEmail,
            p_password: pwd,
            p_nombre: row.nombre.trim(),
          });

          if (rpcErr || !uid) {
            results.push({ email: normalizedEmail, ok: false, error: rpcErr?.message ?? "Error creando usuario" });
            continue;
          }

          // Upsert user_profile
          const { error: profileErr } = await supabaseAdmin.from("user_profiles").upsert({
            id: uid,
            nombre: row.nombre.trim(),
            email: normalizedEmail,
            role: row.role ?? "employee",
            activo: true,
            societies: row.societies ?? [],
            ...(row.dni ? { dni: row.dni.trim().toUpperCase() } : {}),
          }, { onConflict: "id" });

          if (profileErr) {
            results.push({ email: normalizedEmail, ok: false, error: profileErr.message });
            continue;
          }

          results.push({ email: normalizedEmail, ok: true, userId: uid });
        } catch (err) {
          results.push({ email: row.email ?? "?", ok: false, error: String(err) });
        }
      }

      const ok = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok).length;
      return new Response(JSON.stringify({ ok: true, imported: ok, failed, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Falta userId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── set_password ──────────────────────────────────────────────────────────
    if (action === "set_password") {
      if (!password || password.length < 8) {
        return new Response(JSON.stringify({ error: "La contrasena debe tener al menos 8 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Update Supabase Auth session password
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (authErr) throw authErr;
      // Also sync the bcrypt hash used by check_user_password()
      const { error: rpcErr } = await supabaseAdmin.rpc("update_user_password", {
        p_user_id: userId,
        p_new_password: password,
      });
      if (rpcErr) throw rpcErr;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── set_email ─────────────────────────────────────────────────────────────
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

    // ── set_role ──────────────────────────────────────────────────────────────
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

    // ── set_pin ───────────────────────────────────────────────────────────────
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
