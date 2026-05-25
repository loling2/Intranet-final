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

    // userId may come as string or as array element
    const resolvedId = Array.isArray(userId) ? userId[0] : userId;

    if (pwError || !resolvedId) {
      return new Response(JSON.stringify({ error: "Credenciales incorrectas", debug: { pwError, userId } }), {
        status: 401,
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
      JSON.stringify({ userId: resolvedId, email: email.trim().toLowerCase(), profile }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
