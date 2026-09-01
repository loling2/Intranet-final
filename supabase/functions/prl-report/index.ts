import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

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

    const url = new URL(req.url);
    let overrideCuentaId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        overrideCuentaId = body?.sender_cuenta_id ?? null;
      } catch { /* no body */ }
    }

    // ── 2. Active SMTP account (or sender-selected) ─────────────────────────
    let cuenta;
    if (overrideCuentaId) {
      const { data: ovCuenta } = await supabase
        .from("email_cuentas").select("*").eq("id", overrideCuentaId).maybeSingle();
      cuenta = ovCuenta;
    }
    if (!cuenta) {
      const { data: senderSetting } = await supabase
        .from("ui_settings").select("value").eq("key", "prl_report_sender_cuenta_id").maybeSingle();
      if (senderSetting?.value) {
        const { data: selCuenta } = await supabase
          .from("email_cuentas").select("*").eq("id", senderSetting.value).maybeSingle();
        cuenta = selCuenta;
      }
    }
    if (!cuenta) {
      const { data: activeCuenta } = await supabase
        .from("email_cuentas").select("*").eq("activo", true).limit(1).maybeSingle();
      cuenta = activeCuenta;
    }
    if (!cuenta) return json({ error: "No active SMTP account" }, 400);

    const { data: traceRows, error: traceErr } = await supabase.rpc("get_prl_trazabilidad_stats", {});
    if (traceErr) throw new Error(traceErr.message);

    interface PendingDoc {
      doc_id: string;
      nombre_archivo: string;
      folder_nombre: string;
      created_at: string;
    }
    interface TraceRow {
      r_empleado_id: string;
      r_nombre: string;
      r_society_nombre: string;
      r_centro: string;
      r_asignados: number;
      r_descargados: number;
      r_pendientes: number;
      r_docs_pend: PendingDoc[];
    }

    const rows = ((traceRows ?? []) as any[]).map((row): TraceRow => ({
      r_empleado_id: row.r_empleado_id,
      r_nombre: row.r_nombre ?? "",
      r_society_nombre: row.r_society_nombre ?? "",
      r_centro: row.r_centro ?? "",
      r_asignados: Number(row.r_asignados ?? 0),
      r_descargados: Number(row.r_descargados ?? 0),
      r_pendientes: Number(row.r_pendientes ?? 0),
      r_docs_pend: Array.isArray(row.r_docs_pend) ? row.r_docs_pend : [],
    }));
    const pending = rows.filter((row) => row.r_pendientes > 0).sort((a, b) => a.r_nombre.localeCompare(b.r_nombre));
    const totalPendientes = pending.reduce((sum, row) => sum + row.r_pendientes, 0);

    const today = new Date();
    const fmtDate = (d: Date) => {
      const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
      return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
    };
    const fmtDateShort = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

    const subject = `Informe PRL - Documentos pendientes - ${fmtDateShort(today)}`;

    let html: string;

    if (pending.length === 0) {
      html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;"><tr><td style="background:linear-gradient(135deg,#065F46 0%,#047857 60%,#059669 100%);padding:32px 36px;text-align:center;"><div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;margin-bottom:14px;"><span style="font-size:22px;">🛡️</span></div><div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">Informe PRL</div><div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:6px;font-weight:500;">Documentos pendientes — ${fmtDate(today)}</div></td></tr><tr><td style="padding:40px 36px;text-align:center;"><div style="display:inline-block;background:#F0FDF4;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;margin-bottom:16px;">✅</div><div style="font-size:18px;font-weight:700;color:#166534;">Sin pendientes</div><div style="font-size:13px;color:#475569;margin-top:8px;">Todos los empleados tienen la documentación PRL al día.</div></td></tr></table></td></tr></table></body></html>`;
    } else {
      const summaryRows = pending.map((emp, idx) => {
        const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
        return `<tr style="background:${rowBg};"><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;font-weight:600;color:#0F172A;">${emp.r_nombre}</td><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;color:#475569;">${emp.r_society_nombre || "—"}</td><td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;text-align:center;"><span style="display:inline-block;background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;">${emp.r_pendientes} pendiente${emp.r_pendientes !== 1 ? "s" : ""}</span></td></tr>`;
      }).join("");

      html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;"><tr><td align="center"><table width="620" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:620px;"><tr><td style="background:linear-gradient(135deg,#065F46 0%,#047857 60%,#059669 100%);padding:28px 36px 24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">🛡️ Informe PRL — Documentos Pendientes</div><div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;font-weight:500;">${fmtDate(today)}</div></td><td align="right"><div style="display:inline-block;background:rgba(239,68,68,0.25);border:1px solid rgba(239,68,68,0.5);border-radius:20px;padding:6px 14px;"><span style="font-size:13px;font-weight:700;color:#FCA5A5;">${pending.length} empleado${pending.length !== 1 ? "s" : ""}</span></div></td></tr></table></td></tr><tr><td style="padding:28px 32px;"><div style="font-size:14px;font-weight:800;color:#0F172A;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #F1F5F9;letter-spacing:-0.2px;">Resumen de trabajadores con pendientes</div><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;"><thead><tr style="background:#F8FAFC;"><th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #E2E8F0;">Empleado</th><th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #E2E8F0;">Sociedad</th><th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #E2E8F0;">Pendientes</th></tr></thead><tbody>${summaryRows}</tbody></table><p style="margin:20px 0 0;font-size:12px;color:#475569;">📄 Consulta el PDF adjunto para ver el detalle de cada documento, su fecha de asignación y los días transcurridos.</p></td></tr></table></td></tr></table></body></html>`;
    }

    if (!enabled) {
      return json({ ok: true, disabled: true, total_empleados: pending.length });
    }

    const pdf = await buildTraceabilityPdf(rows, today);
    const smtpResp = await sendSmtp({
      host: cuenta.smtp_host,
      port: cuenta.smtp_port,
      security: cuenta.seguridad,
      user: cuenta.email,
      password: cuenta.password,
      from: cuenta.email,
      to: recipient,
      subject,
      text: `Informe PRL - ${fmtDateShort(today)}. ${pending.length} trabajadores con documentos pendientes. El detalle está en el PDF adjunto.`,
      html,
      attachments: [{
        filename: `informe_trazabilidad_prl_${fmtDateShort(today).replaceAll("/", "-")}.pdf`,
        contentType: "application/pdf",
        content: pdf,
      }],
    });

    if (!smtpResp.ok) {
      return json({ error: smtpResp.error ?? "Error al enviar el correo" }, 500);
    }

    return json({ ok: true, total_empleados: pending.length, total_documentos_pendientes: totalPendientes, recipient });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});

type PdfTraceRow = {
  r_nombre: string;
  r_society_nombre: string;
  r_centro: string;
  r_asignados: number;
  r_descargados: number;
  r_pendientes: number;
  r_docs_pend: { doc_id: string; nombre_archivo: string; folder_nombre: string; created_at: string }[];
};

function pdfSafe(value: unknown, max = 42): string {
  return String(value ?? "").replace(/[<>]/g, "").replace(/[\r\n]+/g, " ").slice(0, max);
}

function pdfDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function pendingDays(value: string, today: Date): number {
  const assigned = new Date(value).getTime();
  if (!Number.isFinite(assigned)) return 0;
  return Math.max(0, Math.floor((today.getTime() - assigned) / 86400000));
}

async function buildTraceabilityPdf(rows: PdfTraceRow[], today: Date): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.02, 0.37, 0.27);
  const slate = rgb(0.29, 0.38, 0.52);
  const lightGreen = rgb(0.92, 0.99, 0.96);
  const lightOrange = rgb(1, 0.97, 0.93);
  const orange = rgb(0.76, 0.25, 0.05);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 36;
  const totals = rows.reduce((acc, row) => ({
    assigned: acc.assigned + row.r_asignados,
    downloaded: acc.downloaded + row.r_descargados,
    pending: acc.pending + row.r_pendientes,
  }), { assigned: 0, downloaded: 0, pending: 0 });
  const percentage = totals.assigned ? Math.round((totals.downloaded / totals.assigned) * 100) : 0;
  const fmtLong = today.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addPage = () => { page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - margin; };
  const text = (value: string, x: number, size: number, font = regular, color = slate) => {
    page.drawText(pdfSafe(value, 120), { x, y, size, font, color });
  };
  const line = (x: number, width: number, color = rgb(0.88, 0.91, 0.94)) => {
    page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.6, color });
  };

  text("Estadísticas de Trazabilidad PRL", margin, 17, bold, green); y -= 22;
  text(`Generado el ${fmtLong}`, margin, 10); y -= 14;
  text(`Empleados: ${rows.length}  |  Asignados: ${totals.assigned}  |  Descargados: ${totals.downloaded}  |  Pendientes: ${totals.pending}  |  Cumplimiento: ${percentage}%`, margin, 10); y -= 22;

  const summaryHeaders = ["Empleado", "Sociedad", "Centro", "Asignados", "Descargados", "Pendientes", "%"];
  const summaryWidths = [170, 90, 105, 70, 80, 70, 45];
  const tableWidth = summaryWidths.reduce((a, b) => a + b, 0);
  page.drawRectangle({ x: margin, y: y - 18, width: tableWidth, height: 20, color: green });
  let x = margin + 6;
  summaryHeaders.forEach((header, index) => { page.drawText(header, { x, y: y - 12, size: 8, font: bold, color: rgb(1, 1, 1) }); x += summaryWidths[index]; });
  y -= 30;
  rows.forEach((row, index) => {
    if (y < 70) addPage();
    if (index % 2 === 0) page.drawRectangle({ x: margin, y: y - 6, width: tableWidth, height: 18, color: lightGreen });
    const rowValues = [row.r_nombre, row.r_society_nombre, row.r_centro || "-", String(row.r_asignados), String(row.r_descargados), String(row.r_pendientes), `${row.r_asignados ? Math.round((row.r_descargados / row.r_asignados) * 100) : 0}%`];
    x = margin + 6;
    rowValues.forEach((value, valueIndex) => { text(value, x, 8, regular, rgb(0.12, 0.18, 0.25)); x += summaryWidths[valueIndex]; });
    y -= 18;
  });

  addPage();
  text("Documentos pendientes por trabajador", margin, 15, bold, green); y -= 24;
  text(`Fecha del informe: ${fmtLong}. Los días se calculan desde la fecha de asignación hasta hoy.`, margin, 9); y -= 18;
  const detailHeaders = ["Empleado", "Documento", "Carpeta", "Fecha asignación", "Días totales asignado"];
  const detailWidths = [145, 190, 130, 90, 105];
  const detailWidth = detailWidths.reduce((a, b) => a + b, 0);
  page.drawRectangle({ x: margin, y: y - 18, width: detailWidth, height: 20, color: orange });
  x = margin + 6;
  detailHeaders.forEach((header, index) => { page.drawText(header, { x, y: y - 12, size: 8, font: bold, color: rgb(1, 1, 1) }); x += detailWidths[index]; });
  y -= 30;
  for (const row of rows) {
    for (const doc of row.r_docs_pend) {
      if (y < 52) { addPage(); text("Documentos pendientes por trabajador (continuación)", margin, 13, bold, green); y -= 24; }
      page.drawRectangle({ x: margin, y: y - 6, width: detailWidth, height: 18, color: lightOrange });
      const detailValues = [row.r_nombre, doc.nombre_archivo, doc.folder_nombre, pdfDate(doc.created_at), `${pendingDays(doc.created_at, today)} días`];
      x = margin + 6;
      detailValues.forEach((value, valueIndex) => { text(value, x, 8, regular, rgb(0.12, 0.18, 0.25)); x += detailWidths[valueIndex]; });
      y -= 18;
    }
  }
  return await pdf.save();
}

function toBase64(bytes: Uint8Array): string {
  let result = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(result);
}

function foldBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

async function sendSmtp(opts: {
  host: string; port: number; security: string;
  user: string; password: string; from: string;
  to: string; subject: string; text: string; html?: string;
  attachments?: { filename: string; contentType: string; content: Uint8Array }[];
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

    const writeAll = async (data: Uint8Array) => {
      let offset = 0;
      while (offset < data.length) {
        const written = await conn.write(data.subarray(offset));
        if (!written) throw new Error("SMTP connection closed while sending");
        offset += written;
      }
    };

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
      await writeAll(enc.encode(line + "\r\n"));
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
      const parts = [
        `From: ${opts.from}`, `To: ${opts.to}`, `Subject: ${opts.subject}`,
        `Date: ${date}`, `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`, ``,
        `--${boundary}`, `Content-Type: multipart/alternative; boundary="alt${boundary}"`, ``,
        `--alt${boundary}`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit`, ``, opts.text, ``,
        `--alt${boundary}`, `Content-Type: text/html; charset=UTF-8`, `Content-Transfer-Encoding: 8bit`, ``, opts.html, ``,
        `--alt${boundary}--`, ``,
      ];
      for (const attachment of opts.attachments ?? []) {
        parts.push(
          `--${boundary}`, `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          `Content-Transfer-Encoding: base64`, ``, foldBase64(toBase64(attachment.content)), ``,
        );
      }
      parts.push(`--${boundary}--`, ``, `.`);
      message = parts.join("\r\n");
    } else {
      message = [
        `From: ${opts.from}`, `To: ${opts.to}`, `Subject: ${opts.subject}`,
        `Date: ${date}`, `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=UTF-8`, ``, opts.text, ``, `.`,
      ].join("\r\n");
    }

    const bytes = enc.encode(message + "\r\n");
    for (let off = 0; off < bytes.length; off += 8192) {
      await writeAll(bytes.subarray(off, Math.min(off + 8192, bytes.length)));
    }
    const dataResp = await readResponse();
    if (!dataResp.startsWith("250")) throw new Error("Send failed: " + dataResp);

    await cmd("QUIT");
    try { conn.close(); } catch { /* ignore */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMTP error" };
  }
}
