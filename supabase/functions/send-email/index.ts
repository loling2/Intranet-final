import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function applyVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) return json({ error: "No autorizado" }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (!callerProfile || !["admin", "rrhh"].includes(callerProfile.role)) {
      return json({ error: "Acceso denegado" }, 403);
    }

    const { plantilla_id, cuenta_id, to_email, variables } =
      (await req.json()) as {
        plantilla_id: string;
        cuenta_id: string;
        to_email: string;
        variables: Record<string, string>;
      };

    if (!plantilla_id || !cuenta_id || !to_email) {
      return json({ error: "Faltan parametros requeridos" }, 400);
    }

    // Fetch plantilla and cuenta
    const [{ data: plantilla }, { data: cuenta }] = await Promise.all([
      supabaseAdmin.from("email_plantillas").select("*").eq("id", plantilla_id).maybeSingle(),
      supabaseAdmin.from("email_cuentas").select("*").eq("id", cuenta_id).maybeSingle(),
    ]);

    if (!plantilla) return json({ error: "Plantilla no encontrada" }, 404);
    if (!cuenta) return json({ error: "Cuenta SMTP no encontrada" }, 404);
    if (!cuenta.activo) return json({ error: "La cuenta SMTP esta inactiva" }, 400);

    const asunto = applyVariables(plantilla.asunto, variables);
    const cuerpo = applyVariables(plantilla.cuerpo, variables);

    // Send via SMTP using fetch to a simple SMTP-over-HTTP approach
    // We use the nodemailer-compatible approach via Deno's TCP
    const smtpResp = await sendSmtp({
      host: cuenta.smtp_host,
      port: cuenta.smtp_port,
      security: cuenta.seguridad,
      user: cuenta.email,
      password: cuenta.password,
      from: cuenta.email,
      to: to_email,
      subject: asunto,
      text: cuerpo,
    });

    if (!smtpResp.ok) {
      return json({ error: smtpResp.error ?? "Error al enviar el correo" }, 500);
    }

    return json({ ok: true, message: `Correo enviado a ${to_email}` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});

// ─── Minimal SMTP client using Deno TCP ───────────────────────────────────────

async function sendSmtp(opts: {
  host: string;
  port: number;
  security: string;
  user: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const useSSL = opts.security === "SSL";
    const useStartTLS = opts.security === "STARTTLS" || opts.security === "TLS";

    let conn: Deno.TcpConn | Deno.TlsConn;
    if (useSSL) {
      conn = await Deno.connectTls({ hostname: opts.host, port: opts.port });
    } else {
      conn = await Deno.connect({ hostname: opts.host, port: opts.port });
    }

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return n ? dec.decode(buf.subarray(0, n)) : "";
    };

    const cmd = async (line: string): Promise<string> => {
      await conn.write(enc.encode(line + "\r\n"));
      return await read();
    };

    // Greeting
    await read();
    await cmd(`EHLO localhost`);

    if (useStartTLS) {
      const r = await cmd("STARTTLS");
      if (!r.startsWith("220")) throw new Error("STARTTLS failed: " + r);
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: opts.host });
      await cmd("EHLO localhost");
    }

    // AUTH LOGIN
    await cmd("AUTH LOGIN");
    await cmd(btoa(opts.user));
    const authResp = await cmd(btoa(opts.password));
    if (!authResp.startsWith("235")) throw new Error("Auth failed: " + authResp);

    await cmd(`MAIL FROM:<${opts.from}>`);
    await cmd(`RCPT TO:<${opts.to}>`);
    await cmd("DATA");

    const boundary = crypto.randomUUID().replace(/-/g, "");
    const date = new Date().toUTCString();
    const message = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `Date: ${date}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      opts.text,
      ``,
      `.`,
    ].join("\r\n");

    // suppress unused boundary warning
    void boundary;

    const dataResp = await cmd(message);
    if (!dataResp.startsWith("250")) throw new Error("DATA failed: " + dataResp);

    await cmd("QUIT");
    conn.close();

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
