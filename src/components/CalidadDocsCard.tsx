import { useState, useEffect } from 'react';
import {
  ShieldCheck, FileText, Download, RefreshCw, File, Image,
  FileSpreadsheet, X, ZoomIn, Globe, Building2,
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

interface Props {
  theme: SocietyTheme;
}

const monthNames: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function getFileIcon(tipo: string) {
  if (tipo?.includes('pdf')) return { Icon: FileText, color: '#DC2626' };
  if (tipo?.includes('image')) return { Icon: Image, color: '#0EA5E9' };
  if (tipo?.includes('sheet') || tipo?.includes('excel') || tipo?.includes('spreadsheet'))
    return { Icon: FileSpreadsheet, color: '#16A34A' };
  return { Icon: File, color: '#64748B' };
}

function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CalidadDocsCard({ theme }: Props) {
  const [docs, setDocs] = useState<CalidadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('calidad_documentos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        setDocs((data as CalidadDoc[]) ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handlePreview(doc: CalidadDoc) {
    setLoadingPreview(true);
    setPreviewName(doc.nombre_archivo);
    setPreviewUrl(null);
    try {
      setPreviewUrl(await getWasabiBlobUrl(doc.wasabi_key));
    } catch (e) { console.error(e); }
    finally { setLoadingPreview(false); }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName('');
  }

  async function handleDownload(doc: CalidadDoc) {
    try { await downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo); }
    catch (e) { console.error(e); }
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden transition-all duration-300 flex flex-col"
        style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <ShieldCheck size={16} style={{ color: '#0369A1' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Calidad</h3>
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                {loading ? '...' : `${docs.length} documento${docs.length !== 1 ? 's' : ''} reciente${docs.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 divide-y" style={{ borderColor: theme.border }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#EFF6FF' }}>
                <ShieldCheck size={22} style={{ color: '#7DD3FC' }} />
              </div>
              <p className="text-xs font-medium" style={{ color: theme.textSecondary }}>Sin documentos de calidad</p>
            </div>
          ) : (
            docs.map((doc) => {
              const { Icon, color } = getFileIcon(doc.tipo ?? '');
              const isImage = doc.tipo?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(doc.nombre_archivo);
              const isPdf = doc.tipo === 'application/pdf' || /\.pdf$/i.test(doc.nombre_archivo);
              const canPreview = isImage || isPdf;
              return (
                <div key={doc.id} className="px-5 py-3 flex items-center gap-3 transition-colors duration-150 hover:bg-slate-50">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}0A` }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: theme.textPrimary }}>
                      {doc.nombre_archivo}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {doc.es_general ? (
                        <Globe size={9} style={{ color: '#0369A1' }} />
                      ) : (
                        <Building2 size={9} style={{ color: '#16A34A' }} />
                      )}
                      <span className="text-xs truncate" style={{ color: theme.textSecondary }}>
                        {monthNames[doc.mes] ?? doc.mes} {doc.anio}
                        {doc.tamano_bytes ? ` · ${formatSize(doc.tamano_bytes)}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canPreview && (
                      <button onClick={() => handlePreview(doc)} title="Ver"
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
                        style={{ color: '#0369A1', backgroundColor: '#EFF6FF' }}>
                        <ZoomIn size={12} />
                      </button>
                    )}
                    <button onClick={() => handleDownload(doc)} title="Descargar"
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
                      style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>
                      <Download size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Preview modal */}
      {(previewUrl || loadingPreview) && (
        <div className="fixed inset-0 z-[500] flex flex-col" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ backgroundColor: '#0F172A' }}>
            <p className="text-sm font-medium text-white truncate">{previewName}</p>
            <button onClick={closePreview}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/10">
              <X size={16} className="text-white" />
            </button>
          </div>
          {loadingPreview ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-white">
              <RefreshCw size={20} className="animate-spin" /> Cargando documento...
            </div>
          ) : (
            <iframe src={previewUrl!} className="flex-1 w-full" style={{ border: 'none' }} title={previewName} />
          )}
        </div>
      )}
    </>
  );
}
