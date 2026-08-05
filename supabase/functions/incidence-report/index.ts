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

    // Accept date from query param OR from POST body
    const url = new URL(req.url);
    let targetDate = url.searchParams.get("date");
    if (!targetDate && req.method === "POST") {
      try {
        const body = await req.json();
        targetDate = body?.date ?? null;
      } catch { /* no body */ }
    }
    if (!targetDate) {
      // Default: yesterday (the cron sends at 1 AM for the previous day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = yesterday.toISOString().split("T")[0];
    }

    // ── 1. Check enabled & recipient ──────────────────────────────────────────
    const { data: enabledSetting } = await supabase
      .from("ui_settings").select("value").eq("key", "incidence_report_enabled").maybeSingle();
    const enabled = enabledSetting?.value !== "false";

    const { data: emailSetting } = await supabase
      .from("ui_settings").select("value").eq("key", "incidence_report_email").maybeSingle();

    let recipient = emailSetting?.value;
    if (!recipient) {
      const { data: admin } = await supabase
        .from("user_profiles").select("email").eq("role", "admin")
        .order("created_at").limit(1).maybeSingle();
      recipient = admin?.email;
    }
    if (!recipient) return json({ error: "No recipient email configured" }, 400);

    // ── 2. Active SMTP account ────────────────────────────────────────────────
    const { data: cuenta } = await supabase
      .from("email_cuentas").select("*").eq("activo", true).limit(1).maybeSingle();
    if (!cuenta) return json({ error: "No active SMTP account" }, 400);

    // ── 3. Fetch fichajes for target date ─────────────────────────────────────
    const { data: fichajes, error: fichErr } = await supabase
      .from("fichajes")
      .select("nombre_empleado, fecha, timestamp, timestamp_corregido, tipo_evento, nota_correccion")
      .eq("fecha", targetDate)
      .in("tipo_evento", ["entrada", "salida"])
      .order("timestamp", { ascending: true });

    if (fichErr) throw new Error(fichErr.message);

    // Also fetch total unique employees who worked that day (to show attendance rate)
    const { data: totalEmps } = await supabase
      .from("empleados").select("id").eq("activo", true);
    const totalActive = totalEmps?.length ?? 0;

    // ── 4. Compute summaries ──────────────────────────────────────────────────
    const summaries = new Map<string, {
      entrada: string | null;
      salida: string | null;
      salidaAuto: boolean;
    }>();

    for (const f of fichajes ?? []) {
      const eff = f.timestamp_corregido ?? f.timestamp;
      if (!summaries.has(f.nombre_empleado)) {
        summaries.set(f.nombre_empleado, { entrada: null, salida: null, salidaAuto: false });
      }
      const s = summaries.get(f.nombre_empleado)!;
      if (f.tipo_evento === "entrada") {
        if (!s.entrada || eff < s.entrada) s.entrada = eff;
      } else if (f.tipo_evento === "salida") {
        if (!s.salida || eff > s.salida) {
          s.salida = eff;
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
    const correctos: string[] = [];

    for (const [nombre, s] of summaries) {
      if (!s.entrada) continue;
      if (!s.salida) {
        incidencias.push({ nombre, entrada: s.entrada, salida: null, duracionMin: 0, tipo: "sin_salida", salidaAuto: false });
        continue;
      }
      const durMin = Math.round((new Date(s.salida).getTime() - new Date(s.entrada).getTime()) / 60000);
      if (durMin > 480 || durMin < 360 || s.salidaAuto) {
        incidencias.push({
          nombre, entrada: s.entrada, salida: s.salida, duracionMin: durMin,
          tipo: s.salidaAuto ? "sin_salida" : durMin > 480 ? "exceso" : "deficit",
          salidaAuto: s.salidaAuto,
        });
      } else {
        correctos.push(nombre);
      }
    }

    incidencias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    correctos.sort((a, b) => a.localeCompare(b));

    const totalFicharon = summaries.size;
    const totalIncidencias = incidencias.length;
    const totalCorrectos = correctos.length;

    // ── 5. Build premium HTML email ───────────────────────────────────────────
    const fmtDate = (d: string) => {
      const [y, m, day] = d.split("-");
      const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
      return `${parseInt(day)} de ${months[parseInt(m)-1]} de ${y}`;
    };
    const fmtDateShort = (d: string) => { const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
    const fmtTime = (iso: string | null) => {
      if (!iso) return "—";
      try {
        return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Atlantic/Canary" });
      } catch { return iso; }
    };
    const fmtDur = (min: number) => {
      if (!min) return "—";
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h}h ${m.toString().padStart(2, "0")}m`;
    };
    const dayName = (d: string) => {
      const days = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
      return days[new Date(d + "T12:00:00Z").getUTCDay()];
    };

    const typeConfig: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
      sin_salida: { label: "Sin salida", bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE", dot: "#7C3AED" },
      exceso:     { label: "Exceso +8h",  bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", dot: "#DC2626" },
      deficit:    { label: "Déficit -6h", bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", dot: "#F59E0B" },
    };

    const subject = `📋 Informe de Fichajes — ${dayName(targetDate)} ${fmtDateShort(targetDate)}`;

    // Stats bar
    const statsBar = `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px;">
  <tr>
    <td width="33%" style="padding:0 6px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border-radius:12px;border:1px solid #BBF7D0;">
        <tr><td style="padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#16A34A;line-height:1;">${totalFicharon}</div>
          <div style="font-size:11px;color:#166534;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Ficharon</div>
        </td></tr>
      </table>
    </td>
    <td width="33%" style="padding:0 3px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border-radius:12px;border:1px solid #BBF7D0;">
        <tr><td style="padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#16A34A;line-height:1;">${totalCorrectos}</div>
          <div style="font-size:11px;color:#166534;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Correctos</div>
        </td></tr>
      </table>
    </td>
    <td width="33%" style="padding:0 0 0 6px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${totalIncidencias > 0 ? "#FEF2F2" : "#F0FDF4"};border-radius:12px;border:1px solid ${totalIncidencias > 0 ? "#FECACA" : "#BBF7D0"};">
        <tr><td style="padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:${totalIncidencias > 0 ? "#DC2626" : "#16A34A"};line-height:1;">${totalIncidencias}</div>
          <div style="font-size:11px;color:${totalIncidencias > 0 ? "#991B1B" : "#166534"};margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Incidencias</div>
        </td></tr>
      </table>
    </td>
  </tr>
</table>`;

    let incidenciasBlock = "";
    if (incidencias.length > 0) {
      // Group by type
      const groups: { type: string; items: Incidencia[] }[] = [
        { type: "sin_salida", items: incidencias.filter(i => i.tipo === "sin_salida") },
        { type: "exceso",     items: incidencias.filter(i => i.tipo === "exceso") },
        { type: "deficit",    items: incidencias.filter(i => i.tipo === "deficit") },
      ].filter(g => g.items.length > 0);

      incidenciasBlock = groups.map(group => {
        const cfg = typeConfig[group.type];
        const rows = group.items.map((inc, idx) => {
          const salidaDisplay = inc.tipo === "sin_salida" && !inc.salidaAuto ? "—" : fmtTime(inc.salida);
          const durDisplay = inc.tipo === "sin_salida" && !inc.salidaAuto ? "—" : fmtDur(inc.duracionMin);
          const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
          const autoTag = inc.salidaAuto
            ? `<span style="display:inline-block;font-size:9px;background:#F5F3FF;color:#7C3AED;border:1px solid #DDD6FE;border-radius:4px;padding:1px 5px;margin-left:4px;font-weight:600;vertical-align:middle;">AUTO</span>`
            : "";
          return `
<tr style="background:${rowBg};">
  <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;">
    <div style="font-size:13px;font-weight:600;color:#0F172A;">${inc.nombre}${autoTag}</div>
  </td>
  <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;text-align:center;">
    <span style="display:inline-block;background:#F0FDF4;color:#16A34A;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700;">${fmtTime(inc.entrada)}</span>
  </td>
  <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;text-align:center;">
    <span style="display:inline-block;background:${inc.tipo==="sin_salida" && !inc.salidaAuto ? "#F8FAFC" : "#FEF2F2"};color:${inc.tipo==="sin_salida" && !inc.salidaAuto ? "#94A3B8" : "#DC2626"};border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700;">${salidaDisplay}</span>
  </td>
  <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;text-align:center;">
    <span style="display:inline-block;background:${cfg.bg};color:${cfg.text};border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700;">${durDisplay}</span>
  </td>
</tr>`;
        }).join("");

        return `
<div style="margin-bottom:20px;">
  <div style="display:flex;align-items:center;margin-bottom:8px;">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${cfg.dot};margin-right:8px;flex-shrink:0;"></span>
    <span style="font-size:13px;font-weight:700;color:${cfg.text};text-transform:uppercase;letter-spacing:0.06em;">${cfg.label}</span>
    <span style="margin-left:8px;display:inline-block;font-size:11px;font-weight:700;background:${cfg.bg};color:${cfg.text};border:1px solid ${cfg.border};border-radius:20px;padding:1px 8px;">${group.items.length}</span>
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid ${cfg.border};">
    <thead>
      <tr style="background:${cfg.bg};">
        <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:${cfg.text};text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid ${cfg.border};">Empleado</th>
        <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:${cfg.text};text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid ${cfg.border};">Entrada</th>
        <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:${cfg.text};text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid ${cfg.border};">Salida</th>
        <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:${cfg.text};text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid ${cfg.border};">Duración</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
      }).join("");
    }

    // Correctos block (compact list)
    let correctosBlock = "";
    if (correctos.length > 0) {
      const items = correctos.map(n =>
        `<span style="display:inline-block;margin:3px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:20px;padding:4px 12px;font-size:12px;color:#166534;font-weight:600;">${n}</span>`
      ).join("");
      correctosBlock = `
<div style="margin-top:24px;padding:16px 20px;background:#F0FDF4;border-radius:12px;border:1px solid #BBF7D0;">
  <div style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">✓ Fichajes correctos (${correctos.length})</div>
  <div>${items}</div>
</div>`;
    }

    // Note block
    const notaBlock = incidencias.some(i => i.salidaAuto) ? `
<div style="margin-top:16px;padding:14px 16px;background:#F5F3FF;border-radius:10px;border-left:3px solid #7C3AED;">
  <div style="font-size:11px;font-weight:700;color:#7C3AED;margin-bottom:4px;">ℹ Cierres automáticos</div>
  <div style="font-size:11px;color:#5B21B6;line-height:1.6;">Los fichajes marcados como <strong>AUTO</strong> fueron cerrados por el sistema a las 23:59:59 porque el trabajador no registró la salida. Se recomienda revisar y corregir con la hora real de salida.</div>
</div>` : "";

    let html: string;

    if (incidencias.length === 0 && fichajes && fichajes.length > 0) {
      // All good — clean green report
      html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe de Fichajes</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;">
  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0C4A6E 0%,#0369A1 60%,#0284C7 100%);padding:32px 36px;text-align:center;">
    <div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;margin-bottom:14px;">
      <span style="font-size:22px;">📋</span>
    </div>
    <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">Informe de Fichajes</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:6px;font-weight:500;">${dayName(targetDate)}, ${fmtDate(targetDate)}</div>
  </td></tr>
  <!-- BODY -->
  <tr><td style="padding:32px 36px;">
    ${statsBar}
    <div style="text-align:center;padding:32px 0;">
      <div style="display:inline-block;background:#F0FDF4;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;margin-bottom:16px;">✅</div>
      <div style="font-size:18px;font-weight:700;color:#166534;">Sin incidencias</div>
      <div style="font-size:13px;color:#475569;margin-top:8px;">Todos los empleados ficharon correctamente.</div>
    </div>
    ${correctosBlock}
  </td></tr>
  <!-- FOOTER -->
  <tr><td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 36px;text-align:center;">
    <div style="font-size:11px;color:#94A3B8;">Generado automáticamente · ${new Date().toLocaleDateString("es-ES", { day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Atlantic/Canary" })}</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
    } else if (fichajes && fichajes.length === 0) {
      // No fichajes at all
      html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Informe de Fichajes</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0C4A6E,#0369A1);padding:32px 36px;text-align:center;">
    <div style="font-size:22px;font-weight:800;color:#FFFFFF;">Informe de Fichajes</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:6px;">${dayName(targetDate)}, ${fmtDate(targetDate)}</div>
  </td></tr>
  <tr><td style="padding:40px 36px;text-align:center;">
    <div style="font-size:40px;margin-bottom:16px;">📭</div>
    <div style="font-size:16px;font-weight:700;color:#475569;">Sin registros</div>
    <div style="font-size:13px;color:#94A3B8;margin-top:8px;">No hay fichajes registrados para este día.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
    } else {
      // Has incidencias
      html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe de Fichajes</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:620px;">

  <!-- HEADER GRADIENT -->
  <tr><td style="background:linear-gradient(135deg,#0C4A6E 0%,#0369A1 60%,#0284C7 100%);padding:28px 36px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">📋 Informe de Fichajes</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;font-weight:500;">${dayName(targetDate)}, ${fmtDate(targetDate)}</div>
        </td>
        <td align="right">
          <div style="display:inline-block;background:rgba(239,68,68,0.25);border:1px solid rgba(239,68,68,0.5);border-radius:20px;padding:6px 14px;">
            <span style="font-size:13px;font-weight:700;color:#FCA5A5;">${totalIncidencias} incidencia${totalIncidencias !== 1 ? "s" : ""}</span>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:28px 32px;">

    <!-- Stats -->
    ${statsBar}

    <!-- Incidencias section header -->
    <div style="font-size:14px;font-weight:800;color:#0F172A;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #F1F5F9;letter-spacing:-0.2px;">
      Detalle de incidencias
    </div>

    <!-- Incidencias by group -->
    ${incidenciasBlock}

    <!-- Notas -->
    ${notaBlock}

    <!-- Correctos -->
    ${correctosBlock}

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:14px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><div style="font-size:11px;color:#94A3B8;">Control de Presencia · Informe automático</div></td>
      <td align="right"><div style="font-size:11px;color:#94A3B8;">${new Date().toLocaleDateString("es-ES", { day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Atlantic/Canary" })}</div></td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
    }

    if (!enabled) {
      return json({ ok: true, disabled: true, total_incidencias: incidencias.length });
    }

    // ── 6. Send via SMTP ──────────────────────────────────────────────────────
    const smtpResp = await sendSmtp({
      host: cuenta.smtp_host,
      port: cuenta.smtp_port,
      security: cuenta.seguridad,
      user: cuenta.email,
      password: cuenta.password,
      from: cuenta.email,
      to: recipient,
      subject,
      text: `Informe de Fichajes — ${dayName(targetDate)} ${fmtDateShort(targetDate)}. Incidencias: ${totalIncidencias}. Correctos: ${totalCorrectos}.`,
      html,
    });

    if (!smtpResp.ok) {
      return json({ error: smtpResp.error ?? "Error al enviar el correo" }, 500);
    }

    return json({ ok: true, total_incidencias: incidencias.length, total_correctos: correctos.length, recipient, date: targetDate });
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

    const boundary = crypto.randomUUID().replace(/-/g, "");
    const date = new Date().toUTCString();
    let message: string;

    if (opts.html) {
      message = [
        `From: ${opts.from}`, `To: ${opts.to}`, `Subject: ${opts.subject}`,
        `Date: ${date}`, `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`, ``,
        `--${boundary}`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 7bit`, ``, opts.text, ``,
        `--${boundary}`, `Content-Type: text/html; charset=UTF-8`, `Content-Transfer-Encoding: 7bit`, ``, opts.html, ``,
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
