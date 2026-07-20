import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Rate limit config ────────────────────────────────────────────────────────
// After 5 failed attempts (no token used), lock 20 min.
// After 3 more (8 total), lock 60 min.
// After 3 more (11 total), lock 24h.
// Each subsequent 3 attempts doubles the lock duration.
const LOCK_THRESHOLDS = [5, 8, 11, 14, 17, 20];
const LOCK_DURATIONS_MIN = [20, 60, 1440, 2880, 5760, 11520]; // minutes

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
      const { email } = body as { email?: string };
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
        // Increment attempt count silently; user is not told the wait time
        await admin
          .from("password_reset_attempts")
          .update({
            attempt_count: (attemptRow.attempt_count ?? 0) + 1,
            updated_at: now.toISOString(),
          })
          .eq("email", normalizedEmail);
        // Always return success message (don't leak whether email exists or is locked)
        return json({ ok: true, message: "Si el correo existe, recibiras un mensaje con instrucciones." });
      }

      // Look up the user by email (admin API)
      const { data: userList, error: userErr } = await admin.auth.admin.listUsers();
      let userId: string | null = null;
      if (!userErr && userList?.users) {
        const found = userList.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
        if (found) userId = found.id;
      }

      // Increment attempt count
      const newAttemptCount = (attemptRow?.attempt_count ?? 0) + 1;
      const currentLevel = attemptRow?.lock_level ?? 0;

      // Check if we should escalate the lock
      let newLockLevel = currentLevel;
      let newLockedUntil: string | null = attemptRow?.locked_until ?? null;
      const threshold = thresholdForLevel(currentLevel);
      if (newAttemptCount >= threshold && !userId) {
        // Only lock when the email doesn't exist (failed attempts)
        // Successful requests (email exists) don't count toward escalation
        newLockLevel = currentLevel + 1;
        const lockMinutes = lockForLevel(newLockLevel);
        const lockUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);
        newLockedUntil = lockUntil.toISOString();
      }

      // Upsert attempt row
      if (attemptRow) {
        await admin
          .from("password_reset_attempts")
          .update({
            attempt_count: newAttemptCount,
            lock_level: newLockLevel,
            locked_until: newLockedUntil,
            updated_at: now.toISOString(),
          })
          .eq("email", normalizedEmail);
      } else {
        await admin
          .from("password_reset_attempts")
          .insert({
            email: normalizedEmail,
            attempt_count: newAttemptCount,
            lock_level: newLockLevel,
            locked_until: newLockedUntil,
            updated_at: now.toISOString(),
          });
      }

      // If user exists, create a token and send the email
      if (userId) {
        const token = generateToken();
        const tokenHash = await sha256(token);
        const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

        // Invalidate previous unused tokens for this user
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

        // Build reset URL
        const siteUrl = Deno.env.get("SUPABASE_URL") ?? "";
        // The frontend will read ?token=...&email=... and show the reset form
        const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
        const baseUrl = origin ? origin.split("/").slice(0, 3).join("/") : "https://portal.example.com";
        const resetUrl = `${baseUrl}/?reset_token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

        // Fetch the password_reset plantilla
        const { data: plantilla } = await admin
          .from("email_plantillas")
          .select("*")
          .eq("tipo", "password_reset")
          .eq("activo", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (plantilla) {
          // Fetch a default SMTP account (first active)
          const { data: cuenta } = await admin
            .from("email_cuentas")
            .select("*")
            .eq("activo", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (cuenta) {
            const asunto = applyVariables(plantilla.asunto, { url_reset: resetUrl, email: normalizedEmail });
            const cuerpo = applyVariables(plantilla.cuerpo, { url_reset: resetUrl, email: normalizedEmail });

            // Send via SMTP (best-effort; failures don't leak to user)
            try {
              await sendSmtp({
                host: cuenta.smtp_host,
                port: cuenta.smtp_port,
                security: cuenta.seguridad,
                user: cuenta.email,
                password: cuenta.password,
                from: cuenta.email,
                to: normalizedEmail,
                subject: asunto,
                text: cuerpo,
              });
            } catch (smtpErr) {
              console.error("SMTP send failed:", smtpErr);
              // Don't leak the error to the user
            }
          } else {
            console.warn("No SMTP account configured for password reset email");
          }
        } else {
          console.warn("No active password_reset email plantilla found");
        }
      }

      // Always return the same success message
      return json({ ok: true, message: "Si el correo existe, recibiras un mensaje con instrucciones." });
    }

    // ── action: reset ──────────────────────────────────────────────────────
    if (action === "reset") {
      const { token, email, password } = body as { token?: string; email?: string; password?: string };
      if (!token || !email || !password) {
        return json({ error: "Faltan parametros requeridos" }, 400);
      }

      // Validate password complexity
      if (password.length < 8) {
        return json({ error: "La contrasena debe tener al menos 8 caracteres" }, 400);
      }
      if (!/[A-Z]/.test(password)) {
        return json({ error: "La contrasena debe contener al menos 1 mayuscula" }, 400);
      }
      if (!/[a-z]/.test(password)) {
        return json({ error: "La contrasena debe contener al menos 1 minuscula" }, 400);
      }
      if (!/[0-9]/.test(password)) {
        return json({ error: "La contrasena debe contener al menos 1 numero" }, 400);
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        return json({ error: "La contrasena debe contener al menos 1 simbolo" }, 400);
      }

      const normalizedEmail = email.trim().toLowerCase();
      const tokenHash = await sha256(token);

      const { data: tokenRow } = await admin
        .from("password_reset_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (!tokenRow) {
        return json({ error: "Token invalido o expirado" }, 400);
      }
      if (tokenRow.used_at) {
        return json({ error: "Este enlace ya ha sido utilizado" }, 400);
      }
      if (new Date(tokenRow.expires_at) < new Date()) {
        return json({ error: "El enlace ha expirado. Solicita uno nuevo." }, 400);
      }
      if (!tokenRow.user_id) {
        return json({ error: "Token invalido" }, 400);
      }

      // Update the user's password
      const { error: updateErr } = await admin.auth.admin.updateUserById(tokenRow.user_id, { password });
      if (updateErr) {
        return json({ error: updateErr.message }, 500);
      }

      // Mark token as used
      await admin
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      // Reset the attempt counter on successful reset
      await admin
        .from("password_reset_attempts")
        .upsert({
          email: normalizedEmail,
          attempt_count: 0,
          lock_level: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "email" });

      return json({ ok: true, message: "Contrasena actualizada correctamente" });
    }

    return json({ error: "Accion no reconocida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});

// ── Minimal SMTP client ────────────────────────────────────────────────────────
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

    await read();
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

    const dataResp = await cmd(message);
    if (!dataResp.startsWith("250")) throw new Error("DATA failed: " + dataResp);

    await cmd("QUIT");
    conn.close();

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
