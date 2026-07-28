import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LOCK_THRESHOLDS = [5, 8, 11, 14, 17, 20];
const LOCK_DURATIONS_MIN = [20, 60, 1440, 2880, 5760, 11520];

function lockForLevel(level: number): number {
  if (level <= 0) return 0;
  const idx = Math.min(level - 1, LOCK_DURATIONS_MIN.length - 1);
  return LOCK_DURATIONS_MIN[idx];
}

function thresholdForLevel(level: number): number {
  const idx = Math.min(level, LOCK_THRESHOLDS.length - 1);
  return LOCK_THRESHOLDS[idx];
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function applyVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function buildHtmlEmail(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restablecer contraseña</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0C4A6E,#0369A1);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">Portal de Empleado</p>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Recuperacion de acceso</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#1E293B;font-weight:600;">Hola,</p>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
                Haz clic en el botón de abajo para establecer una nueva contraseña.
                Este enlace es válido durante <strong>30 minutos</strong>.
              </p>
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#0C4A6E,#0369A1);color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.3px;">
                      Establecer contraseña
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:13px;color:#94A3B8;line-height:1.5;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#64748B;word-break:break-all;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;">
                ${resetUrl}
              </p>
              <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.5;">
                Si no has solicitado este cambio, puedes ignorar este correo.
                Tu contraseña actual sigue siendo válida.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">Este correo ha sido enviado automáticamente. Por favor, no respondas a este mensaje.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action } = body as { action: string };

    // ── action: request ────────────────────────────────────────────────────
    if (action === "request") {
      const { email, app_url: bodyAppUrl } = body as { email?: string; app_url?: string };
      if (!email || !email.trim()) {
        return json({ error: "El correo es obligatorio" }, 400);
      }
      const normalizedEmail = email.trim().toLowerCase();

      // Check rate limit
      const { data: attemptRow } = await admin
        .from("password_reset_attempts")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();

      const now = new Date();
      if (attemptRow?.locked_until && new Date(attemptRow.locked_until) > now) {
        await admin
          .from("password_reset_attempts")
          .update({ attempt_count: (attemptRow.attempt_count ?? 0) + 1, updated_at: now.toISOString() })
          .eq("email", normalizedEmail);
        return json({ ok: true, message: "Si el correo existe, recibiras un mensaje con instrucciones." });
      }

      // Verify the email exists in the empleados table
      const { data: empleado } = await admin
        .from("empleados")
        .select("id, email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      // Look up the auth user via user_profiles (avoids listUsers pagination issues)
      const { data: profile } = await admin
        .from("user_profiles")
        .select("id, email, role")
        .eq("email", normalizedEmail)
        .maybeSingle();

      let userId: string | null = null;
      if (profile?.id) {
        userId = profile.id;
      }

      // Only proceed if the email exists in empleados AND in auth (user_profiles)
      const emailExistsInEmpleados = !!empleado;
      const emailExistsInAuth = !!userId;

      // Increment attempt count
      const newAttemptCount = (attemptRow?.attempt_count ?? 0) + 1;
      const currentLevel = attemptRow?.lock_level ?? 0;

      let newLockLevel = currentLevel;
      let newLockedUntil: string | null = attemptRow?.locked_until ?? null;
      const threshold = thresholdForLevel(currentLevel);
      if (newAttemptCount >= threshold && (!emailExistsInEmpleados || !emailExistsInAuth)) {
        newLockLevel = currentLevel + 1;
        const lockMinutes = lockForLevel(newLockLevel);
        const lockUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);
        newLockedUntil = lockUntil.toISOString();
      }

      if (attemptRow) {
        await admin
          .from("password_reset_attempts")
          .update({ attempt_count: newAttemptCount, lock_level: newLockLevel, locked_until: newLockedUntil, updated_at: now.toISOString() })
          .eq("email", normalizedEmail);
      } else {
        await admin
          .from("password_reset_attempts")
          .insert({ email: normalizedEmail, attempt_count: newAttemptCount, lock_level: newLockLevel, locked_until: newLockedUntil, updated_at: now.toISOString() });
      }

      // Only send the email if the user exists in both empleados and auth
      if (emailExistsInEmpleados && emailExistsInAuth && userId) {
        const token = generateToken();
        const tokenHash = await sha256(token);
        const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

        // Invalidate previous unused tokens
        await admin
          .from("password_reset_tokens")
          .update({ used_at: now.toISOString() })
          .eq("user_id", userId)
          .is("used_at", null);

        await admin.from("password_reset_tokens").insert({
          email: normalizedEmail,
          token_hash: tokenHash,
          user_id: userId,
          expires_at: expiresAt.toISOString(),
        });

        // Determine the app URL: prefer configured app_url, fall back to origin header
        const { data: appUrlSetting } = await admin
          .from("ui_settings")
          .select("value")
          .eq("key", "app_url")
          .maybeSingle();

        const configuredUrl = appUrlSetting?.value?.trim();
        const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
        const isWebcontainer = origin.includes("webcontainer-api.io") || origin.includes("localhost");
        const originBase = origin ? origin.split("/").slice(0, 3).join("/") : "";
        const baseUrl = (bodyAppUrl && !bodyAppUrl.includes("localhost") && !bodyAppUrl.includes("webcontainer-api.io")) ? bodyAppUrl
          : (configuredUrl && !isWebcontainer) ? configuredUrl
          : (origin && !isWebcontainer) ? originBase
          : configuredUrl || originBase || "https://portal.example.com";
        const resetUrl = `${baseUrl}/?reset_token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

        // Fetch active SMTP account
        const { data: cuenta } = await admin
          .from("email_cuentas")
          .select("*")
          .eq("activo", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (cuenta) {
          const subject = "Establece tu nueva contraseña de acceso";
          const htmlBody = buildHtmlEmail(resetUrl);
          const textBody = `Has solicitado restablecer tu contraseña.\n\nHaz clic en el siguiente enlace para establecer una nueva contraseña (válido 30 minutos):\n\n${resetUrl}\n\nSi no solicitaste este cambio, ignora este correo.`;

          try {
            await sendSmtp({
              host: cuenta.smtp_host,
              port: cuenta.smtp_port,
              security: cuenta.seguridad,
              user: cuenta.email,
              password: cuenta.password,
              from: cuenta.email,
              to: normalizedEmail,
              subject,
              text: textBody,
              html: htmlBody,
            });
          } catch (smtpErr) {
            console.error("SMTP send failed:", smtpErr);
          }
        } else {
          console.warn("No SMTP account configured for password reset email");
        }
      }

      return json({ ok: true, message: "Si el correo existe, recibiras un mensaje con instrucciones." });
    }

    // ── action: reset ──────────────────────────────────────────────────────
    if (action === "reset") {
      const { token, email, password } = body as { token?: string; email?: string; password?: string };
      if (!token || !email || !password) {
        return json({ error: "Faltan parametros requeridos" }, 400);
      }

      if (password.length < 8) return json({ error: "La contrasena debe tener al menos 8 caracteres" }, 400);
      if (!/[A-Z]/.test(password)) return json({ error: "La contrasena debe contener al menos 1 mayuscula" }, 400);
      if (!/[a-z]/.test(password)) return json({ error: "La contrasena debe contener al menos 1 minuscula" }, 400);
      if (!/[0-9]/.test(password)) return json({ error: "La contrasena debe contener al menos 1 numero" }, 400);
      if (!/[^A-Za-z0-9]/.test(password)) return json({ error: "La contrasena debe contener al menos 1 simbolo" }, 400);

      const normalizedEmail = email.trim().toLowerCase();
      const tokenHash = await sha256(token);

      const { data: tokenRow } = await admin
        .from("password_reset_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (!tokenRow) return json({ error: "Token invalido o expirado" }, 400);
      if (tokenRow.used_at) return json({ error: "Este enlace ya ha sido utilizado" }, 400);
      if (new Date(tokenRow.expires_at) < new Date()) return json({ error: "El enlace ha expirado. Solicita uno nuevo." }, 400);
      if (!tokenRow.user_id) return json({ error: "Token invalido" }, 400);

      const { error: updateErr } = await admin.auth.admin.updateUserById(tokenRow.user_id, { password });
      if (updateErr) return json({ error: updateErr.message }, 500);

      await admin
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      await admin
        .from("password_reset_attempts")
        .upsert({ email: normalizedEmail, attempt_count: 0, lock_level: 0, locked_until: null, updated_at: new Date().toISOString() }, { onConflict: "email" });

      return json({ ok: true, message: "Contrasena actualizada correctamente" });
    }

    return json({ error: "Accion no reconocida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});

// ── SMTP client with HTML support ─────────────────────────────────────────────
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
      // Read until we get a line with a status code followed by space (not dash)
      // Multi-line SMTP responses use dash for continuation: "250-SIZE", "250 HELP"
      for (let i = 0; i < 10; i++) {
        const n = await conn.read(buf);
        if (!n) break;
        result += dec.decode(buf.subarray(0, n));
        // Check if the last line ends with a status code + space (end of response)
        const lines = result.split("\r\n").filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (lastLine && /^\d{3} /.test(lastLine)) break;
        // If no more data available, break
        if (n < buf.length) break;
      }
      return result;
    };

    const cmd = async (line: string): Promise<string> => {
      await conn.write(enc.encode(line + "\r\n"));
      return await readResponse();
    };

    await readResponse();
    await cmd("EHLO localhost");

    if (useStartTLS) {
      const r = await cmd("STARTTLS");
      if (!r.startsWith("220")) throw new Error("STARTTLS failed: " + r);
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: opts.host });
      await cmd("EHLO localhost");
    }

    await cmd("AUTH LOGIN");
    await cmd(btoa(opts.user));
    const authResp = await cmd(btoa(opts.password));
    if (!authResp.startsWith("235")) throw new Error("Auth failed: " + authResp);

    await cmd(`MAIL FROM:<${opts.from}>`);
    await cmd(`RCPT TO:<${opts.to}>`);
    await cmd("DATA");

    const date = new Date().toUTCString();
    const boundary = `----=_Part_${Date.now()}`;

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

    const dataResp = await cmd(message);
    if (!dataResp.startsWith("250")) throw new Error("DATA failed: " + dataResp);

    await cmd("QUIT");
    conn.close();

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
