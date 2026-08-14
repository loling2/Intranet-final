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

    const { data: enabledSetting } = await supabase
      .from("ui_settings").select("value").eq("key", "prl_report_enabled").maybeSingle();
    const enabled = enabledSetting?.value !== "false";

    const { data: emailSetting } = await supabase
      .from("ui_settings").select("value").eq("key", "prl_report_email").maybeSingle();

    let recipient = emailSetting?.value;
    if (!recipient) {
      const { data: admin } = await supabase
        .from("user_profiles").select("email").eq("role", "admin")
        .order("created_at").limit(1).maybeSingle();
      recipient = admin?.email;
    }
    if (!recipient) return json({ error: "No recipient email configured" }, 400);

    const { data: cuenta } = await supabase
      .from("email_cuentas").select("*").eq("activo", true).limit(1).maybeSingle();
    if (!cuenta) return json({ error: "No active SMTP account" }, 400);

    const { data: empleados, error: empErr } = await supabase
      .from("empleados")
      .select("nombre, apellidos, puesto, prl_ficha_puesto, prl_evaluacion_riesgos, prl_medidas_emergencia, prl_plan_prevencion, reconocimiento_medico, entrega_doc_prl")
      .eq("activo", true)
      .order("nombre");

    if (empErr) throw new Error(empErr.message);

    interface PendingEmp { nombre: string; puesto: string | null; docs: string[] }
    const pending: PendingEmp[] = [];

    for (const e of empleados ?? []) {
      const docs: string[] = [];
      if (!e.prl_ficha_puesto) docs.push("Ficha de puesto");
      if (!e.prl_evaluacion_riesgos) docs.push("Evaluacion de riesgos");
      if (!e.prl_medidas_emergencia) docs.push("Medidas de emergencia");
      if (!e.prl_plan_prevencion) docs.push("Plan de prevencion");
      if (!e.reconocimiento_medico || e.reconocimiento_medico === "pendiente") docs.push("Reconocimiento medico");
      if (!e.entrega_doc_prl || e.entrega_doc_prl !== "recibida") docs.push("Entrega doc PRL");

      if (docs.length > 0) {
        const fullName = [e.nombre, e.apellidos].filter(Boolean).join(" ").trim();
        pending.push({ nombre: fullName, puesto: e.puesto, docs });
      }
    }

    pending.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const totalPendientes = pending.length;

    const today = new Date();
    const fmtDate = (d: Date) => {
      const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
      return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
    };
    const fmtDateShort = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

    const subject = `🛡️ Informe PRL — Documentos Pendientes — ${fmtDateShort(today)}`;

    let html: string;

    if (totalPendientes === 0) {
      html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;"><tr><td style="background:linear-gradient(135deg,#065F46 0%,#047857 60%,#059669 100%);padding:32px 36px;text-align:center;"><div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;margin-bottom:14px;"><span style="font-size:22px;">🛡️</span></div><div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">Informe PRL</div><div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:6px;font-weight:500;">Documentos pendientes — ${fmtDate(today)}</div></td></tr><tr><td style="padding:40px 36px;text-align:center;"><div style="display:inline-block;background:#F0FDF4;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;margin-bottom:16px;">✅</div><div style="font-size:18px;font-weight:700;color:#166534;">Sin pendientes</div><div style="font-size:13px;color:#475569;margin-top:8px;">Todos los empleados tienen la documentación PRL al día.</div></td></tr></table></td></tr></table></body></html>`;
    } else {
      const rows = pending.map((emp, idx) => {
        const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
        const docsHtml = emp.docs.map(d => `<span style="display:inline-block;margin:2px;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;">${d}</span>`).join("");
        return `<tr style="background:${rowBg};"><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;font-weight:600;color:#0F172A;">${emp.nombre}</td><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;color:#475569;">${emp.puesto ?? "—"}</td><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;">${docsHtml}</td></tr>`;
      }).join("");

      html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;"><tr><td align="center"><table width="620" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:620px;"><tr><td style="background:linear-gradient(135deg,#065F46 0%,#047857 60%,#059669 100%);padding:28px 36px 24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">🛡️ Informe PRL — Documentos Pendientes</div><div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;font-weight:500;">${fmtDate(today)}</div></td><td align="right"><div style="display:inline-block;background:rgba(239,68,68,0.25);border:1px solid rgba(239,68,68,0.5);border-radius:20px;padding:6px 14px;"><span style="font-size:13px;font-weight:700;color:#FCA5A5;">${totalPendientes} empleado${totalPendientes !== 1 ? "s" : ""}</span></div></td></tr></table></td></tr><tr><td style="padding:28px 32px;"><div style="font-size:14px;font-weight:800;color:#0F172A;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #F1F5F9;letter-spacing:-0.2px;">Trabajadores con documentos pendientes</div><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;"><thead><tr style="background:#F8FAFC;"><th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #E2E8F0;">Empleado</th><th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #E2E8F0;">Puesto</th><th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #E2E8F0;">Documentos pendientes</th></tr></thead><tbody>${rows}</tbody></table><p style="margin:20px 0 0;font-size:11px;color:#94A3B8;">Este informe se genera automáticamente según la frecuencia configurada.</p></td></tr></table></td></tr></table></body></html>`;
    }

    if (!enabled) {
      return json({ ok: true, disabled: true, total_empleados: totalPendientes });
    }

    const smtpResp = await sendSmtp({
      host: cuenta.smtp_host,
      port: cuenta.smtp_port,
      security: cuenta.seguridad,
      user: cuenta.email,
      password: cuenta.password,
      from: cuenta.email,
      to: recipient,
      subject,
      text: `Informe PRL — Documentos Pendientes — ${fmtDateShort(today)}. Empleados con pendientes: ${totalPendientes}.`,
      html,
    });

    if (!smtpResp.ok) {
      return json({ error: smtpResp.error ?? "Error al enviar el correo" }, 500);
    }

    return json({ ok: true, total_empleados: totalPendientes, recipient });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});

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
