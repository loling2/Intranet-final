import { useState, useEffect } from 'react';
import { ShieldCheck, FileText, Download, Tag, RefreshCw, Folder } from 'lucide-react';
import { supabase } from './supabaseClient';
import type { SocietyTheme } from './themes';

interface PrevDoc {
  id: string;
  nombre_archivo: string;
  tipo: string | null;
  created_at: string;
  wasabi_key: string | null;
  folder_nombre: string;
}

interface Props {
  theme: SocietyTheme;
  userEmail: string;
}

export default function PrevencionDocsCard({ theme, userEmail }: Props) {
  const [docs, setDocs] = useState<PrevDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // 1. Find the empleado record — try by user_id (auth session) first, fallback to email
        const { data: { session } } = await supabase.auth.getSession();
        let empId: string | null = null;

        if (session?.user?.id) {
          const { data: empByUid } = await supabase
            .from('empleados')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();
          empId = empByUid?.id ?? null;
        }

        // Fallback: search by email (requires admin/rrhh policy or matching row)
        if (!empId) {
          const { data: empByEmail } = await supabase
            .from('empleados')
            .select('id')
            .eq('email', userEmail)
            .maybeSingle();
          empId = empByEmail?.id ?? null;
        }

        if (!empId) { setDocs([]); return; }

        // 2. Get all tag ids assigned to this employee
        const { data: etiquetas } = await supabase
          .from('etiquetado')
          .select('tag_id')
          .eq('entidad_id', empId);

        const tagIds = (etiquetas ?? []).map((e: { tag_id: string }) => e.tag_id);

        if (tagIds.length === 0) { setDocs([]); return; }

        // 3. Find prl_folders whose access_tag_id is in the employee's tags (or null = public)
        const { data: folders } = await supabase
          .from('prl_folders')
          .select('id, nombre')
          .or(`access_tag_id.in.(${tagIds.join(',')}),access_tag_id.is.null`);

        if (!folders || folders.length === 0) { setDocs([]); return; }

        const folderIds = folders.map((f: { id: string }) => f.id);
        const folderMap: Record<string, string> = {};
        folders.forEach((f: { id: string; nombre: string }) => { folderMap[f.id] = f.nombre; });

        // 4. Get documents from those folders
        const { data: documents } = await supabase
          .from('prl_documents')
          .select('id, nombre_archivo, tipo, created_at, wasabi_key, folder_id')
          .in('folder_id', folderIds)
          .order('created_at', { ascending: false })
          .limit(10);

        const result: PrevDoc[] = (documents ?? []).map((d: {
          id: string; nombre_archivo: string; tipo: string | null;
          created_at: string; wasabi_key: string | null; folder_id: string;
        }) => ({
          id: d.id,
          nombre_archivo: d.nombre_archivo,
          tipo: d.tipo,
          created_at: d.created_at,
          wasabi_key: d.wasabi_key,
          folder_nombre: folderMap[d.folder_id] ?? '',
        }));

        setDocs(result);
      } catch {
        setDocs([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userEmail]);

  const handleDownload = async (wasabiKey: string, nombre: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/wasabi-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ key: wasabiKey }),
      });
      if (!resp.ok) return;
      const { url } = await resp.json();
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { /* silent */ }
  };

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-300" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
            <ShieldCheck size={16} style={{ color: '#065F46' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Documentos Prevencion</h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>{docs.length} documentos disponibles</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#ECFDF5' }}>
              <ShieldCheck size={22} style={{ color: '#6EE7B7' }} />
            </div>
            <p className="text-xs font-medium" style={{ color: theme.textSecondary }}>Sin documentos de prevencion</p>
            <p className="text-xs mt-0.5" style={{ color: theme.textSecondary, opacity: 0.6 }}>Tu responsable de PRL los subira aqui</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:opacity-80"
                style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7' }}>
                <FileText size={14} style={{ color: '#065F46', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#065F46' }}>{doc.nombre_archivo}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Folder size={9} style={{ color: '#059669' }} />
                    <p className="text-xs truncate" style={{ color: '#059669' }}>
                      {doc.folder_nombre}{doc.tipo ? ` · ${doc.tipo}` : ''} · {new Date(doc.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                {doc.wasabi_key && (
                  <button
                    onClick={() => handleDownload(doc.wasabi_key!, doc.nombre_archivo)}
                    className="flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ color: '#065F46' }}
                    title="Descargar"
                  >
                    <Download size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tags info */}
        <div className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>
          <Tag size={11} style={{ color: theme.textSecondary }} />
          <p className="text-xs" style={{ color: theme.textSecondary }}>
            Tus tags de prevencion determinan los documentos que recibes
          </p>
        </div>
      </div>
    </div>
  );
}
