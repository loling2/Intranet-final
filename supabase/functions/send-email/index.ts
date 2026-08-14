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

    const {
      plantilla_id,
      cuenta_id,
      to_email,
      variables,
      html_override,
      subject_override,
    } = (await req.json()) as {
      plantilla_id: string;
      cuenta_id: string;
      to_email: string;
      variables: Record<string, string>;
      html_override?: string;
      subject_override?: string;
    };

    if (!cuenta_id || !to_email) {
      return json({ error: "Faltan parametros requeridos" }, 400);
    }

    // Fetch plantilla (optional when html_override is provided) and cuenta
    const [{ data: plantilla }, { data: cuenta }] = await Promise.all([
      plantilla_id
        ? supabaseAdmin.from("email_plantillas").select("*").eq("id", plantilla_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin.from("email_cuentas").select("*").eq("id", cuenta_id).maybeSingle(),
    ]);

    if (!plantilla && !html_override) return json({ error: "Plantilla no encontrada" }, 404);
    if (!cuenta) return json({ error: "Cuenta SMTP no encontrada" }, 404);
    if (!cuenta.activo) return json({ error: "La cuenta SMTP esta inactiva" }, 400);

    const asunto = subject_override
      ? subject_override
      : applyVariables(plantilla!.asunto, variables);
    const cuerpo = plantilla
      ? applyVariables(plantilla.cuerpo, variables)
      : "Informe de incidencias de fichaje.";
    const htmlBody = html_override
      ? html_override
      : buildAccessHtml(asunto, cuerpo, variables);

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
      html: htmlBody,
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

function buildAccessHtml(subject: string, textBody: string, vars: Record<string, string>): string {
  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapePlain = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

  const urlAcceso = vars.url_acceso || "";
  const email = escapeHtml(vars.email || "");
  const password = escapeHtml(vars.password || "");
  const nombre = escapeHtml(vars.nombre || "");
  const empresa = escapeHtml(vars.empresa || "la empresa");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0C4A6E,#0369A1);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">Portal de Empleado</p>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${escapeHtml(subject)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#1E293B;font-weight:600;">Hola${nombre ? ", " + nombre : ""},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
                ${escapePlain(textBody)}
              </p>
              ${urlAcceso ? `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${escapeHtml(urlAcceso)}"
                       style="display:inline-block;background:linear-gradient(135deg,#0C4A6E,#0369A1);color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.3px;">
                      Acceder al portal
                    </a>
                  </td>
                </tr>
              </table>` : ""}
              ${(email || password) ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:24px;">
                ${email ? `<tr><td style="padding:12px 16px;border-bottom:1px solid #E2E8F0;"><span style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;">Correo</span><br/><span style="font-size:14px;color:#1E293B;font-weight:600;">${email}</span></td></tr>` : ""}
                ${password ? `<tr><td style="padding:12px 16px;"><span style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;">Contraseña</span><br/><span style="font-size:14px;color:#1E293B;font-weight:600;font-family:monospace;">${password}</span></td></tr>` : ""}
              </table>` : ""}
              <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.5;">
                Por favor, cambia tu contraseña después de iniciar sesión.<br/>Si no esperabas este correo, puedes ignorarlo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">Este correo ha sido enviado automáticamente por ${empresa}. Por favor, no respondas a este mensaje.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
  html?: string;
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

    // Read full SMTP response (may span multiple packets)
    const readResponse = async (): Promise<string> => {
      let result = "";
      const buf = new Uint8Array(4096);
      for (let i = 0; i < 10; i++) {
        const n = await conn.read(buf);
        if (!n) break;
        result += dec.decode(buf.subarray(0, n));
        const lines = result.split("\r\n").filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (lastLine && /^\d{3} /.test(lastLine)) break;
        if (n < buf.length) break;
      }
      return result;
    };

    const cmd = async (line: string): Promise<string> => {
      await conn.write(enc.encode(line + "\r\n"));
      return await readResponse();
    };

    // Greeting
    await readResponse();
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

    let message: string;
    if (opts.html) {
      message = [
        `From: ${opts.from}`,
        `To: ${opts.to}`,
        `Subject: ${opts.subject}`,
        `Date: ${date}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        opts.text,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        opts.html,
        ``,
        `--${boundary}--`,
        ``,
        `.`,
      ].join("\r\n");
    } else {
      message = [
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
    }

    // Write DATA in chunks to avoid overflowing the TCP buffer on large HTML emails
    const CHUNK = 8192;
    const fullData = message + "\r\n";
    const bytes = enc.encode(fullData);
    for (let off = 0; off < bytes.length; off += CHUNK) {
      const end = Math.min(off + CHUNK, bytes.length);
      await conn.write(bytes.subarray(off, end));
    }

    const dataResp = await readResponse();
    if (!dataResp.startsWith("250")) throw new Error("DATA failed: " + dataResp);

    await cmd("QUIT");
    conn.close();

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
