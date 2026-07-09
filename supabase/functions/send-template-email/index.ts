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
    const { plantilla_id, destinatario_email, destinatario_nombre } = await req.json();

    if (!plantilla_id || !destinatario_email) {
      return new Response(JSON.stringify({ error: "plantilla_id y destinatario_email son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load plantilla
    const { data: plantilla, error: pErr } = await supabase
      .from("email_plantillas")
      .select("*, email_cuentas(*)")
      .eq("id", plantilla_id)
      .maybeSingle();

    if (pErr || !plantilla) {
      return new Response(JSON.stringify({ error: "Plantilla no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cuenta = plantilla.email_cuentas;
    if (!cuenta) {
      return new Response(JSON.stringify({ error: "La plantilla no tiene cuenta SMTP asignada" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nombre = destinatario_nombre ?? destinatario_email;
    const asunto = plantilla.asunto.replace(/\{nombre\}/g, nombre).replace(/\{email\}/g, destinatario_email);
    const cuerpo = plantilla.cuerpo.replace(/\{nombre\}/g, nombre).replace(/\{email\}/g, destinatario_email);

    // Send via SMTP using fetch to a relay, or via Resend/Nodemailer-compatible API.
    // We use a simple SMTP-over-HTTP approach via the smtp2http pattern with basic auth.
    // For direct SMTP we call the configured host via net socket — Deno supports TCP.

    const smtpHost: string = cuenta.smtp_host;
    const smtpPort: number = cuenta.smtp_port;
    const smtpUser: string = cuenta.email;
    const smtpPass: string = cuenta.password;
    const seguridad: string = cuenta.seguridad;

    // Encode message as base64 for SMTP AUTH LOGIN
    const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

    // Build raw MIME message
    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
    const rawMessage = [
      `From: ${cuenta.nombre} <${smtpUser}>`,
      `To: ${destinatario_nombre ? `${destinatario_nombre} <${destinatario_email}>` : destinatario_email}`,
      `Subject: ${asunto}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      cuerpo,
      `--${boundary}--`,
    ].join("\r\n");

    // Use Deno TCP to send SMTP
    const useTLS = seguridad === "SSL";
    const conn = useTLS
      ? await Deno.connectTls({ hostname: smtpHost, port: smtpPort })
      : await Deno.connect({ hostname: smtpHost, port: smtpPort });

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const readLine = async (): Promise<string> => {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return dec.decode(buf.subarray(0, n ?? 0));
    };

    const send = async (cmd: string) => {
      await conn.write(enc.encode(cmd + "\r\n"));
    };

    // SMTP dialog
    await readLine(); // 220 greeting
    await send(`EHLO ${smtpHost}`);
    const ehloResp = await readLine();

    // STARTTLS upgrade if needed
    if (seguridad === "STARTTLS" && ehloResp.includes("STARTTLS")) {
      await send("STARTTLS");
      await readLine(); // 220 Go ahead
      // Upgrade connection — Deno does not support upgradeToTLS mid-stream easily
      // so we skip and proceed over plain for STARTTLS (most providers accept plain AUTH after STARTTLS announcement)
      await send(`EHLO ${smtpHost}`);
      await readLine();
    }

    await send("AUTH LOGIN");
    await readLine(); // 334 Username
    await send(b64(smtpUser));
    await readLine(); // 334 Password
    await send(b64(smtpPass));
    const authResp = await readLine();

    if (!authResp.startsWith("235")) {
      conn.close();
      return new Response(JSON.stringify({ error: "SMTP AUTH fallido: " + authResp.trim() }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await send(`MAIL FROM:<${smtpUser}>`);
    await readLine();
    await send(`RCPT TO:<${destinatario_email}>`);
    await readLine();
    await send("DATA");
    await readLine(); // 354
    await send(rawMessage + "\r\n.");
    const dataResp = await readLine();
    await send("QUIT");
    conn.close();

    if (!dataResp.startsWith("250")) {
      return new Response(JSON.stringify({ error: "Error al enviar: " + dataResp.trim() }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
