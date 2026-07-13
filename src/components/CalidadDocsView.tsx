import { useState, useEffect } from 'react';
import {
  Download, Eye, Loader2, FolderOpen, Globe, Building2, X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getWasabiBlobUrl, downloadFromWasabi } from '../lib/wasabi';
import type { SocietyTheme } from '../themes';

interface CalidadDoc {
  id: string;
  nombre_archivo: string;
  wasabi_key: string;
  tipo: string | null;
  tamano_bytes: number | null;
  es_general: boolean;
  sociedad_ids: string[] | null;
  anio: string;
  mes: string;
  subido_por_nombre: string | null;
  created_at: string;
}

const monthNames: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  theme: SocietyTheme;
}

export default function CalidadDocsView({ theme }: Props) {
  const [docs, setDocs] = useState<CalidadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [filterTipo, setFilterTipo] = useState<'todos' | 'general' | 'sociedad'>('todos');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('calidad_documentos').select('*').order('created_at', { ascending: false });
        setDocs((data as CalidadDoc[]) ?? []);
      } finally { setLoading(false); }
    })();
  }, []);

  async function handlePreview(doc: CalidadDoc) {
    setLoadingPreview(true); setPreviewName(doc.nombre_archivo);
    try { setPreviewUrl(await getWasabiBlobUrl(doc.wasabi_key)); }
    catch (e) { console.error(e); }
    finally { setLoadingPreview(false); }
  }

  const filteredDocs = docs.filter(d => {
    if (filterTipo === 'general' && !d.es_general) return false;
    if (filterTipo === 'sociedad' && d.es_general) return false;
    return true;
  });

  return (
    <>
    <div>
      <div className="flex gap-1 p-1 rounded-lg mb-4 inline-flex" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {([{'id':'todos','label':'Todos'},{'id':'general','label':'General'},{'id':'sociedad','label':'Por Sociedad'}] as const).map(f => (
          <button key={f.id} onClick={() => setFilterTipo(f.id)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer"
            style={{ backgroundColor: filterTipo === f.id ? theme.primary : 'transparent', color: filterTipo === f.id ? '#FFFFFF' : '#64748B' }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#94A3B8' }}>
          <Loader2 size={18} className="animate-spin" /> Cargando documentos...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <FolderOpen size={32} style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay documentos de calidad disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map(doc => (
            <div key={doc.id} className="rounded-xl p-4 transition-all duration-300" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: doc.es_general ? '#EFF6FF' : '#F0FDF4' }}>
                  {doc.es_general ? <Globe size={16} style={{ color: '#0369A1' }} /> : <Building2 size={16} style={{ color: '#16A34A' }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{doc.nombre_archivo}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                    {monthNames[doc.mes] ?? doc.mes} {doc.anio} - {formatSize(doc.tamano_bytes ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: doc.es_general ? '#EFF6FF' : '#F0FDF4', color: doc.es_general ? '#0369A1' : '#16A34A' }}>
                  {doc.es_general ? 'General' : 'Por Sociedad'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePreview(doc)} title="Ver"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-blue-50" style={{ color: '#0369A1' }}>
                  <Eye size={15} />
                </button>
                <button onClick={() => downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo)} title="Descargar"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-slate-100" style={{ color: '#475569' }}>
                  <Download size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(previewUrl || loadingPreview) && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ backgroundColor: '#0F172A' }}>
            <p className="text-sm font-medium text-white truncate">{previewName}</p>
            <button onClick={() => { setPreviewUrl(null); setPreviewName(''); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/10">
              <X size={16} className="text-white" />
            </button>
          </div>
          {loadingPreview ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-white">
              <Loader2 size={20} className="animate-spin" /> Cargando documento...
            </div>
          ) : (
            <iframe src={previewUrl!} className="flex-1 w-full" style={{ border: 'none' }} title={previewName} />
          )}
        </div>
      )}
    </div>
    </>
  );
}
