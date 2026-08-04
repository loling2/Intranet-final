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

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const targetDate = dateParam || new Date().toISOString().split("T")[0];

    // ── 1. Check if enabled & get recipient ────────────────────────────────
    const { data: enabledSetting } = await supabase
      .from("ui_settings")
      .select("value")
      .eq("key", "incidence_report_enabled")
      .maybeSingle();
    const enabled = enabledSetting?.value !== "false";

    const { data: emailSetting } = await supabase
      .from("ui_settings")
      .select("value")
      .eq("key", "incidence_report_email")
      .maybeSingle();

    let recipient = emailSetting?.value;
    if (!recipient) {
      const { data: admin } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("role", "admin")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      recipient = admin?.email;
    }

    if (!recipient) {
      return json({ error: "No recipient email configured" }, 400);
    }

    // ── 2. Get active SMTP account ──────────────────────────────────────────
    const { data: cuenta } = await supabase
      .from("email_cuentas")
      .select("*")
      .eq("activo", true)
      .limit(1)
      .maybeSingle();

    if (!cuenta) {
      return json({ error: "No active SMTP account" }, 400);
    }

    // ── 3. Fetch fichajes for target date ───────────────────────────────────
    const { data: fichajes, error: fichErr } = await supabase
      .from("fichajes")
      .select("nombre_empleado, fecha, timestamp, timestamp_corregido, tipo_evento, nota_correccion")
      .eq("fecha", targetDate)
      .in("tipo_evento", ["entrada", "salida"])
      .order("timestamp", { ascending: true });

    if (fichErr) throw new Error(fichErr.message);

    // ── 4. Compute per-employee durations + detect sin salida ──────────────
    const summaries = new Map<string, {
      entrada: string | null;
      salida: string | null;
      salidaAuto: boolean;
    }>();

    for (const f of fichajes ?? []) {
      const eff = f.timestamp_corregido ?? f.timestamp;
      const key = f.nombre_empleado;
      if (!summaries.has(key)) {
        summaries.set(key, { entrada: null, salida: null, salidaAuto: false });
      }
      const s = summaries.get(key)!;
      if (f.tipo_evento === "entrada") {
        if (!s.entrada || eff < s.entrada) s.entrada = eff;
      } else if (f.tipo_evento === "salida") {
        if (!s.salida || eff > s.salida) {
          s.salida = eff;
          // Detect auto-close (nota set by system)
          s.salidaAuto = (f.nota_correccion ?? "").includes("Cierre automático");
        }
      }
    }

    interface Incidencia {
      nombre: string;
      entrada: string | null;
      salida: string | null;
      duracionMin: number;
      tipo: "exceso" | "deficit" | "sin_salida";
      salidaAuto: boolean;
    }

    const incidencias: Incidencia[] = [];

    for (const [nombre, s] of summaries) {
      if (!s.entrada) continue;

      if (!s.salida) {
        // Employee has entrada but no salida yet
        incidencias.push({
          nombre,
          entrada: s.entrada,
          salida: null,
          duracionMin: 0,
          tipo: "sin_salida",
          salidaAuto: false,
        });
        continue;
      }

      const diffMs = new Date(s.salida).getTime() - new Date(s.entrada).getTime();
      const durMin = Math.round(diffMs / 60000);
      if (durMin > 480 || durMin < 360 || s.salidaAuto) {
        incidencias.push({
          nombre,
          entrada: s.entrada,
          salida: s.salida,
          duracionMin: durMin,
          tipo: s.salidaAuto ? "sin_salida" : durMin > 480 ? "exceso" : "deficit",
          salidaAuto: s.salidaAuto,
        });
      }
    }

    incidencias.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // ── 5. Build HTML email ─────────────────────────────────────────────────
    const fmtDate = (d: string) => {
      const parts = d.split("-");
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };
    const fmtTime = (iso: string | null) => {
      if (!iso) return "—";
      try {
        return new Date(iso).toLocaleTimeString("es-ES", {
          hour: "2-digit", minute: "2-digit", timeZone: "Atlantic/Canary"
        });
      } catch { return iso; }
    };
    const fmtDur = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h}h ${m.toString().padStart(2, "0")}m`;
    };

    const subject = `Informe Diario de Incidencias - ${fmtDate(targetDate)}`;

    let html: string;
    if (incidencias.length === 0) {
      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#0C4A6E,#0369A1);padding:32px 40px;text-align:center;">
<p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;">Informe de Incidencias</p>
<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${fmtDate(targetDate)}</p>
</td></tr><tr><td style="padding:36px 40px;text-align:center;">
<p style="margin:0;font-size:15px;color:#16A34A;font-weight:600;">No hay incidencias hoy</p>
<p style="margin:8px 0 0;font-size:14px;color:#475569;">Todos los empleados ficharon correctamente.</p>
</td></tr></table></td></tr></table></body></html>`;
    } else {
      const rows = incidencias.map((inc) => {
        let color: string;
        let label: string;
        let salidaText: string;

        if (inc.tipo === "sin_salida") {
          color = "#7C3AED";
          label = inc.salidaAuto
            ? "Sin salida (cierre auto)"
            : "Sin salida registrada";
          salidaText = inc.salidaAuto ? fmtTime(inc.salida) : "—";
        } else if (inc.tipo === "exceso") {
          color = "#DC2626";
          label = "Exceso (&gt;8h)";
          salidaText = fmtTime(inc.salida);
        } else {
          color = "#D97706";
          label = "Déficit (&lt;6h)";
          salidaText = fmtTime(inc.salida);
        }

        const durText = inc.tipo === "sin_salida" && !inc.salidaAuto
          ? "—"
          : fmtDur(inc.duracionMin);

        return `<tr>
<td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;">${inc.nombre}</td>
<td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;">${fmtDate(targetDate)}</td>
<td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;color:#16A34A;">${fmtTime(inc.entrada)}</td>
<td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;color:#DC2626;">${salidaText}</td>
<td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;font-weight:bold;color:${color};">${durText}</td>
<td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;font-weight:bold;color:${color};">${label}</td>
</tr>`;
      }).join("");

      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#0C4A6E,#0369A1);padding:32px 40px;text-align:center;">
<p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;">Informe de Incidencias de Fichaje</p>
<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${fmtDate(targetDate)}</p>
</td></tr><tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:14px;color:#475569;">Se han detectado <strong style="color:#DC2626;">${incidencias.length}</strong> incidencia(s) en los fichajes del día:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<thead><tr>
<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Empleado</th>
<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Fecha</th>
<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Entrada</th>
<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Salida</th>
<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Horas</th>
<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Tipo</th>
</tr></thead><tbody>${rows}</tbody></table>
<div style="margin:16px 0;padding:10px 14px;border-radius:8px;background:#F8F5FF;border-left:3px solid #7C3AED;">
  <p style="margin:0;font-size:12px;color:#7C3AED;font-weight:600;">Nota sobre cierres automáticos</p>
  <p style="margin:4px 0 0;font-size:11px;color:#6B7280;">Los fichajes marcados como "cierre automático" se cerraron a las 23:59:59 porque el trabajador no registró la salida. El trabajador debe enviar una solicitud de corrección con su hora real de salida.</p>
</div>
<p style="margin:12px 0 0;font-size:11px;color:#94A3B8;">Los fichajes sin salida se cierran automáticamente a las 23:55 cada día.</p>
</td></tr></table></td></tr></table></body></html>`;
    }

    if (!enabled) {
      return json({ ok: true, disabled: true, total_incidencias: incidencias.length });
    }

    // ── 6. Send via SMTP ───────────────────────────────────────────────────
    const smtpResp = await sendSmtp({
      host: cuenta.smtp_host,
      port: cuenta.smtp_port,
      security: cuenta.seguridad,
      user: cuenta.email,
      password: cuenta.password,
      from: cuenta.email,
      to: recipient,
      subject,
      text: `Informe de Incidencias - ${fmtDate(targetDate)}. Total: ${incidencias.length}.`,
      html,
    });

    if (!smtpResp.ok) {
      return json({ error: smtpResp.error ?? "Error al enviar el correo" }, 500);
    }

    return json({ ok: true, total_incidencias: incidencias.length, recipient });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});

// ─── Minimal SMTP client ──────────────────────────────────────────────────────

async function sendSmtp(opts: {
  host: string; port: number; security: string;
  user: string; password: string; from: string;
  to: string; subject: string; text: string; html?: string;
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

    await readResponse();
    await cmd(`EHLO localhost`);

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

    const boundary = crypto.randomUUID().replace(/-/g, "");
    const date = new Date().toUTCString();

    let message: string;
    if (opts.html) {
      message = [
        `From: ${opts.from}`, `To: ${opts.to}`, `Subject: ${opts.subject}`,
        `Date: ${date}`, `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`, ``,
        `--${boundary}`, `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`, ``, opts.text, ``,
        `--${boundary}`, `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`, ``, opts.html, ``,
        `--${boundary}--`, ``, `.`,
      ].join("\r\n");
    } else {
      message = [
        `From: ${opts.from}`, `To: ${opts.to}`, `Subject: ${opts.subject}`,
        `Date: ${date}`, `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=UTF-8`, ``, opts.text, ``, `.`,
      ].join("\r\n");
    }

    await conn.write(enc.encode(message + "\r\n"));
    const dataResp = await readResponse();
    if (!dataResp.startsWith("250")) throw new Error("Send failed: " + dataResp);

    await cmd("QUIT");
    try { conn.close(); } catch { /* ignore */ }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMTP error" };
  }
}
