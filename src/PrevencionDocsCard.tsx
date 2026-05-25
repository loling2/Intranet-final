import { useState, useEffect } from 'react';
import { ShieldCheck, FileText, Download, Tag, RefreshCw } from 'lucide-react';
import { supabase } from './supabaseClient';
import type { SocietyTheme } from './themes';

interface PrevDoc {
  id: string;
  nombre_archivo: string;
  tipo: string;
  fecha_subida: string;
  wasabi_key: string | null;
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
        // Documents uploaded by prevencion role targeted at this user or public prevencion docs
        const { data } = await supabase
          .from('documents')
          .select('id, nombre_archivo, tipo, fecha_subida, wasabi_key')
          .eq('folder', 'prevencion')
          .or(`usuario_destino_email.eq.${userEmail},usuario_destino_id.is.null`)
          .order('fecha_subida', { ascending: false })
          .limit(5);
        setDocs((data ?? []) as PrevDoc[]);
      } catch {
        setDocs([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userEmail]);

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
        <button className="text-xs font-medium cursor-pointer" style={{ color: '#065F46' }}>
          Ver todos
        </button>
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
                  <p className="text-xs" style={{ color: '#059669' }}>{doc.tipo} &middot; {new Date(doc.fecha_subida).toLocaleDateString('es-ES')}</p>
                </div>
                {doc.wasabi_key && (
                  <button className="flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity" style={{ color: '#065F46' }}>
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
