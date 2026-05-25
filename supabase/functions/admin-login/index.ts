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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify password via SQL function
    const { data: userId, error: pwError } = await supabaseAdmin.rpc("check_user_password", {
      p_email: email.trim().toLowerCase(),
      p_password: password,
    });

    const resolvedId = Array.isArray(userId) ? userId[0] : userId;

    if (pwError || !resolvedId) {
      return new Response(JSON.stringify({ error: "Credenciales incorrectas" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a real session token for this user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim().toLowerCase(),
    });

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: "Error generando sesion: " + linkError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange the OTP token for a real session
    const supabasePublic = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = linkData.properties?.hashed_token;
    const { data: sessionData, error: sessionError } = await supabasePublic.auth.verifyOtp({
      token_hash: token,
      type: "magiclink",
    });

    if (sessionError || !sessionData.session) {
      return new Response(JSON.stringify({ error: "Error creando sesion: " + sessionError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("id", resolvedId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        userId: resolvedId,
        email: email.trim().toLowerCase(),
        profile,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
