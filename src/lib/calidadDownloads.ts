import { supabase } from '../supabaseClient';

export async function recordCalidadDownload(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('log_calidad_download', { p_document_id: documentId });
  if (error) throw error;
}
