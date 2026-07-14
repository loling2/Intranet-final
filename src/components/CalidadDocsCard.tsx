import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, FileText, Download, RefreshCw, File, Image,
  FileSpreadsheet, X, ZoomIn, Globe, Building2, Calendar, User as UserIcon,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getWasabiBlobUrl, downloadFromWasabi } from '../lib/wasabi';
import { societies as allSocieties } from '../themes';
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
  societyId?: string | null;
  mini?: boolean;
}

const monthNames: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

const monthList = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

const yearList = ['2024', '2025', '2026', '2027'];

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

export default function CalidadDocsCard({ theme, societyId, mini }: Props) {
  const [docs, setDocs] = useState<CalidadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [generalOpen, setGeneralOpen] = useState(true);
  const [sociedadOpen, setSociedadOpen] = useState(true);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calidad_documentos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs((data as CalidadDoc[]) ?? []);
    } catch (e) {
      console.error('Error loading calidad docs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

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

  const filtered = docs.filter(d => {
    if (filterYear !== 'all' && d.anio !== filterYear) return false;
    if (filterMonth !== 'all' && d.mes !== filterMonth) return false;
    return true;
  });

  const generalDocs = filtered.filter(d => d.es_general);
  const sociedadDocs = filtered.filter(d => !d.es_general && (
    societyId ? (d.sociedad_ids?.includes(societyId) ?? false) : true
  ));

  const availableYears = [...new Set(docs.map(d => d.anio))].sort().reverse();

  function renderDocCard(doc: CalidadDoc) {
    const { Icon, color } = getFileIcon(doc.tipo ?? '');
    const isImage = doc.tipo?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(doc.nombre_archivo);
    const isPdf = doc.tipo === 'application/pdf' || /\.pdf$/i.test(doc.nombre_archivo);
    const canPreview = isImage || isPdf;
    return (
      <div key={doc.id}
        className="rounded-xl p-4 transition-all duration-200 hover:shadow-md"
        style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}0A` }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>{doc.nombre_archivo}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {doc.es_general ? (
                <Globe size={10} style={{ color: '#0369A1' }} />
              ) : (
                <Building2 size={10} style={{ color: '#16A34A' }} />
              )}
              <span className="text-xs" style={{ color: theme.textSecondary }}>
                {doc.es_general ? 'General' : `${doc.sociedad_ids?.length ?? 0} sociedad(es)`}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: theme.textSecondary }}>
              <Calendar size={10} /> {monthNames[doc.mes] ?? doc.mes} {doc.anio}
              {doc.tamano_bytes ? ` · ${formatSize(doc.tamano_bytes)}` : ''}
            </div>
            {doc.subido_por_nombre && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: theme.textSecondary }}>
                <UserIcon size={10} /> {doc.subido_por_nombre}
              </div>
            )}
          </div>
        </div>
        {!doc.es_general && doc.sociedad_ids && doc.sociedad_ids.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {doc.sociedad_ids.map(sid => {
              const soc = allSocieties.find(s => s.id === sid);
              return (
                <span key={sid} className="text-xs px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}>
                  {soc?.name ?? sid.slice(0, 8)}
                </span>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          {canPreview && (
            <button onClick={() => handlePreview(doc)} title="Ver"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:opacity-70"
              style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
              <ZoomIn size={12} /> Ver
            </button>
          )}
          <button onClick={() => handleDownload(doc)} title="Descargar"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:opacity-70"
            style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
            <Download size={12} /> Descargar
          </button>
        </div>
      </div>
    );
  }

  function renderSection(title: string, icon: React.ReactNode, docs: CalidadDoc[], open: boolean, toggle: () => void) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <button onClick={toggle}
          className="w-full px-5 py-4 flex items-center justify-between cursor-pointer transition-colors hover:opacity-80"
          style={{ borderBottom: open && docs.length > 0 ? `1px solid ${theme.border}` : 'none' }}>
          <div className="flex items-center gap-2.5">
            {icon}
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{title}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: theme.textSecondary }}>
                {docs.length}
              </span>
            </div>
          </div>
          {open ? <ChevronDown size={16} style={{ color: theme.textSecondary }} /> : <ChevronRight size={16} style={{ color: theme.textSecondary }} />}
        </button>
        {open && (
          <div className="p-4">
            {docs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#EFF6FF' }}>
                  <ShieldCheck size={22} style={{ color: '#7DD3FC' }} />
                </div>
                <p className="text-xs font-medium" style={{ color: theme.textSecondary }}>Sin documentos</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {docs.map(renderDocCard)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (mini) {
    const recentDocs = [...docs].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 3);
    return (
      <div className="rounded-2xl overflow-hidden flex flex-col h-full transition-all duration-200 hover:shadow-lg"
        style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
            <ShieldCheck size={18} style={{ color: '#0369A1' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Calidad</h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {docs.length} documento{docs.length !== 1 ? 's' : ''} disponible{docs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: '#EFF6FF' }}>
                <ShieldCheck size={18} style={{ color: '#7DD3FC' }} />
              </div>
              <p className="text-xs" style={{ color: theme.textSecondary }}>Sin documentos</p>
            </div>
          ) : (
            recentDocs.map(doc => {
              const { Icon, color } = getFileIcon(doc.tipo ?? '');
              return (
                <div key={doc.id} className="flex items-center gap-2.5 p-2 rounded-lg transition-colors hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}0A` }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: theme.textPrimary }}>{doc.nombre_archivo}</p>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>
                      {monthNames[doc.mes] ?? doc.mes} {doc.anio}
                    </p>
                  </div>
                  <button onClick={() => handleDownload(doc)} title="Descargar"
                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:opacity-70 flex-shrink-0"
                    style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                    <Download size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filters bar */}
        <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: theme.textSecondary }} />
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={{ border: `1px solid ${theme.border}`, backgroundColor: '#F8FAFC', color: theme.textPrimary }}>
              <option value="all">Todos los años</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={{ border: `1px solid ${theme.border}`, backgroundColor: '#F8FAFC', color: theme.textPrimary }}>
            <option value="all">Todos los meses</option>
            {monthList.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <span className="text-xs ml-auto" style={{ color: theme.textSecondary }}>
            {filtered.length} documento{filtered.length !== 1 ? 's' : ''}
          </span>
          <button onClick={loadDocs}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
            style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : (
          <>
            {renderSection(
              'Documentos Generales (Todas las Sociedades)',
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                <Globe size={16} style={{ color: '#0369A1' }} />
              </div>,
              generalDocs, generalOpen, () => setGeneralOpen(!generalOpen)
            )}
            {renderSection(
              societyId
                ? `Documentos de ${allSocieties.find(s => s.id === societyId)?.name ?? 'mi Sociedad'}`
                : 'Documentos por Sociedad',
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0FDF4' }}>
                <Building2 size={16} style={{ color: '#16A34A' }} />
              </div>,
              sociedadDocs, sociedadOpen, () => setSociedadOpen(!sociedadOpen)
            )}
          </>
        )}
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
