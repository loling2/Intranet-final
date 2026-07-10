import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { plantillaId, destinatario, variables = {} } = await req.json();
    if (!plantillaId || !destinatario?.email) {
      return new Response(JSON.stringify({ error: "plantillaId y destinatario.email son obligatorios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: plantilla, error: pErr } = await supabase.from("email_plantillas").select("*, email_cuentas(*)").eq("id", plantillaId).eq("activo", true).single();
    if (pErr || !plantilla) {
      return new Response(JSON.stringify({ error: "Plantilla no encontrada o inactiva" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const cuenta = plantilla.email_cuentas;
    if (!cuenta) {
      return new Response(JSON.stringify({ error: "La plantilla no tiene cuenta SMTP configurada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const allVars: Record<string, string> = {
      nombre: destinatario.nombre ?? "",
      email: destinatario.email,
      fecha: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
      empresa: cuenta.nombre ?? "la empresa",
      ...variables,
    };
    const asunto = interpolate(plantilla.asunto, allVars);
    const cuerpo = interpolate(plantilla.cuerpo, allVars);
    const { SMTPClient } = await import("npm:emailjs@4");
    const client = new SMTPClient({ user: cuenta.email, password: cuenta.password, host: cuenta.smtp_host, port: cuenta.smtp_port, ssl: cuenta.seguridad === "SSL", tls: cuenta.seguridad === "TLS" });
    await client.sendAsync({ from: `${cuenta.nombre} <${cuenta.email}>`, to: destinatario.email, subject: asunto, text: cuerpo.replace(/<[^>]+>/g, " "), attachment: [{ data: `<html><body>${cuerpo.replace(/\n/g, "<br>")}</body></html>`, alternative: true }] });
    supabase.from("notificaciones_empleado").insert({ user_id: destinatario.id, tipo: "email", titulo: asunto, descripcion: `Plantilla "${plantilla.nombre}" enviada a ${destinatario.email}`, leida: false }).then(() => {}).catch(() => {});
    return new Response(JSON.stringify({ success: true, message: `Correo enviado a ${destinatario.email}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
