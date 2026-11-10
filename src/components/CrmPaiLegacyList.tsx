import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Download, Clock } from 'lucide-react';
import { downloadFromWasabi, getWasabiBlobUrl } from '../lib/wasabi';

interface Props {
  usuarioId: string;
}

interface PlanAnterior {
  id: string;
  tipo: string;
  version: number;
  fecha_creacion: string;
  estado: string;
  objetivos: string;
}

interface PaiDoc {
  id: string;
  nombre_archivo: string;
  wasabi_key: string;
  tamano_bytes: number;
}

const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;

export default function CrmPaiLegacyList({ usuarioId }: Props) {
  const [planes, setPlanes] = useState<PlanAnterior[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docsByPlan, setDocsByPlan] = useState<Record<string, PaiDoc[]>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('crm_pai')
        .select('id, tipo, version, fecha_creacion, estado, objetivos')
        .eq('usuario_servicio_id', usuarioId)
        .order('fecha_creacion', { ascending: false });
      if (cancelled) return;
      setPlanes((data ?? []) as PlanAnterior[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [usuarioId]);

  async function toggleDocs(paiId: string) {
    if (expandedId === paiId) { setExpandedId(null); return; }
    setExpandedId(paiId);
    if (docsByPlan[paiId]) return;
    const { data } = await supabase
      .from('crm_pai_documentos')
      .select('id, nombre_archivo, wasabi_key, tamano_bytes')
      .eq('pai_id', paiId)
      .order('created_at', { ascending: false });
    setDocsByPlan(prev => ({ ...prev, [paiId]: (data ?? []) as PaiDoc[] }));
  }

  if (loading || planes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm" style={{ color: '#475569' }}>Planes anteriores (solo lectura)</h3>
      {planes.map(p => {
        const docs = docsByPlan[p.id];
        const isExpanded = expandedId === p.id;
        return (
          <div key={p.id} className="rounded-xl p-4" style={cardStyle}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{p.tipo} v{p.version}</span>
                <span className="text-xs" style={{ color: '#94A3B8' }}>{p.fecha_creacion}</span>
              </div>
              <button onClick={() => toggleDocs(p.id)} className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md flex items-center gap-1 flex-shrink-0" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>
                <FileText size={11} />Documentos
              </button>
            </div>
            {p.objetivos && <p className="text-sm mt-2" style={{ color: '#1E293B' }}>{p.objetivos}</p>}

            {isExpanded && (
              <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid #F1F5F9' }}>
                {!docs ? (
                  <div className="flex justify-center py-2"><Clock size={14} className="animate-spin" style={{ color: '#0369A1' }} /></div>
                ) : docs.length === 0 ? (
                  <p className="text-xs text-center py-2" style={{ color: '#94A3B8' }}>No hay documentos adjuntos</p>
                ) : docs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <FileText size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                    <span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{doc.nombre_archivo}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>{(doc.tamano_bytes / 1024).toFixed(0)} KB</span>
                    <button onClick={() => getWasabiBlobUrl(doc.wasabi_key).then(url => window.open(url, '_blank')).catch(console.error)}
                      className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-slate-200" title="Ver">
                      <FileText size={12} style={{ color: '#0369A1' }} />
                    </button>
                    <button onClick={() => downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo).catch(console.error)}
                      className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-slate-200" title="Descargar">
                      <Download size={12} style={{ color: '#475569' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
