import { supabase, UserProfile } from '../supabaseClient';

export async function writeAuditLog(params: {
  evento: string;
  descripcion: string;
  autor: UserProfile;
  entidad: string;
  entidad_id?: string;
  metadata?: Record<string, unknown>;
  society_id?: string;
}) {
  const { evento, descripcion, autor, entidad, entidad_id, metadata, society_id } = params;
  await supabase.from('audit_logs').insert({
    evento,
    descripcion,
    autor_id: autor.id,
    autor_nombre: autor.nombre,
    autor_email: autor.email,
    entidad,
    entidad_id: entidad_id ?? null,
    metadata: metadata ?? {},
    society_id: society_id ?? null,
  });
}
