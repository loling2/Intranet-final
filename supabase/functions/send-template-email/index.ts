import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { plantilla_id, destinatario_email, destinatario_nombre } = await req.json();

    if (!plantilla_id || !destinatario_email) {
      return new Response(
        JSON.stringify({ error: "plantilla_id y destinatario_email son obligatorios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load template with its SMTP account
    const { data: plantilla, error: pErr } = await supabase
      .from("email_plantillas")
      .select("*, email_cuentas(*)")
      .eq("id", plantilla_id)
      .single();

    if (pErr || !plantilla) {
      return new Response(
        JSON.stringify({ error: "Plantilla no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cuenta = plantilla.email_cuentas;
    if (!cuenta) {
      return new Response(
        JSON.stringify({ error: "La plantilla no tiene cuenta SMTP asignada" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!cuenta.activo) {
      return new Response(
        JSON.stringify({ error: "La cuenta SMTP asignada esta inactiva" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Replace placeholders in subject and body
    const nombre = destinatario_nombre ?? destinatario_email;
    const asunto = plantilla.asunto
      .replace(/\{nombre\}/g, nombre)
      .replace(/\{email\}/g, destinatario_email);
    const cuerpo = plantilla.cuerpo
      .replace(/\{nombre\}/g, nombre)
      .replace(/\{email\}/g, destinatario_email);

    // Build SMTP connection string and send via fetch to Deno SMTP
    const smtpConfig = {
      hostname: cuenta.smtp_host,
      port: cuenta.smtp_port,
      username: cuenta.email,
      password: cuenta.password,
      tls: cuenta.seguridad === "SSL" || cuenta.seguridad === "TLS",
      starttls: cuenta.seguridad === "STARTTLS",
    };

    // Use a minimal raw SMTP send via fetch to a relay, or Deno built-in TCP
    // We'll use the npm: deno smtp client
    const { SMTPClient } = await import("npm:emailjs@4.0.4");

    const client = new SMTPClient({
      user: smtpConfig.username,
      password: smtpConfig.password,
      host: smtpConfig.hostname,
      port: smtpConfig.port,
      tls: smtpConfig.tls,
    });

    await client.sendAsync({
      from: `${cuenta.nombre} <${cuenta.email}>`,
      to: destinatario_email,
      subject: asunto,
      text: cuerpo,
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
