import { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, Users, FileText, LogOut, Search, Plus, X, ChevronLeft, Tag, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Upload, RefreshCw, CircleUser as UserCircle, KeyRound, Building2, Trash2, CreditCard as Edit2, HeartPulse, Activity, HelpCircle, Eye, File, Image as ImageIcon, FileSpreadsheet, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase, type Empleado, type Sociedad, type Tag as TagType } from './supabaseClient';
import { getWasabiBlobUrl, uploadToWasabi } from './lib/wasabi';
import SocietySwitcher from './SocietySwitcher';
import PrlDocsModule from './components/PrlDocsModule';
import TrazabilidadModule from './components/TrazabilidadModule';
import ChangePasswordModal from './components/ChangePasswordModal';
import HelpPanel from './components/HelpPanel';
import TagsManager from './components/TagsManager';
import { Pagination, paginate, totalPages } from './components/Pagination';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateEmployee?: () => void;
}

type PrevTab = 'empleados' | 'tags' | 'documentos' | 'trazabilidad' | 'departamentos' | 'reconocimiento' | 'vitaly' | 'ayuda';

// Colors per prevention tag category
const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Oficina':                   { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  'Electricista':              { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  'Obras / Construccion':      { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  'Almacen / Logistica':       { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  'Conduccion':                { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
  'Trabajo en Altura':         { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  'Espacios Confinados':       { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  'Manipulacion de Cargas':    { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  'Exposicion a Quimicos':     { bg: '#FAF5FF', text: '#7C3AED', border: '#DDD6FE' },
  'Pantallas de Visualizacion':{ bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
};

function tagColor(nombre: string) {
  return TAG_COLORS[nombre] ?? { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' };
}

type PrevencionDocument = {
  id: string;
  nombre: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  subido_por_nombre: string;
  created_at: string;
};

function getPrevencionFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  return File;
}

function formatPrevencionBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PrevencionDocumentsModalProps {
  employeeId: string;
  employeeName: string;
  refreshKey: number;
  onClose: () => void;
}

function PrevencionDocumentsModal({ employeeId, employeeName, refreshKey, onClose }: PrevencionDocumentsModalProps) {
  const [docs, setDocs] = useState<PrevencionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PrevencionDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    supabase
      .from('employee_documents')
      .select('id, nombre, storage_path, mime_type, size_bytes, subido_por_nombre, created_at')
      .eq('employee_id', employeeId)
      .eq('folder', 'prevencion')
      .order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError(true);
        setDocs((data ?? []) as PrevencionDocument[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [employeeId, refreshKey]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handlePreview = async (doc: PrevencionDocument) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    try {
      setPreviewUrl(await getWasabiBlobUrl(doc.storage_path));
    } catch {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl" style={{ backgroundColor: '#FFFFFF' }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#065F46' }}>Carpeta Prevencion</p>
            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>{employeeName}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}><X size={16} /></button>
        </div>

        <div className="max-h-[calc(85vh-88px)] overflow-y-auto p-5">
          {error && <p className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>No se pudo cargar o previsualizar el documento.</p>}
          {loading ? (
            <div className="py-10 text-center" style={{ color: '#64748B' }}>Cargando documentos...</div>
          ) : docs.length === 0 ? (
            <div className="py-10 text-center" style={{ color: '#64748B' }}>
              <FileText size={32} className="mx-auto mb-2" style={{ color: '#A7F3D0' }} />
              <p>La carpeta Prevencion esta lista, pero aun no tiene documentos.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => {
                const DocIcon = getPrevencionFileIcon(doc.mime_type);
                return (
                  <div key={doc.id} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <DocIcon size={18} style={{ color: '#065F46' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: '#1E293B' }}>{doc.nombre}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>{formatPrevencionBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString('es-ES')}</p>
                    </div>
                    <button onClick={() => handlePreview(doc)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" title="Ver documento" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}><Eye size={15} /></button>
                  </div>
                );
              })}
            </div>
          )}

          {previewDoc && (
            <div className="mt-5 rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
                <p className="truncate text-sm font-semibold" style={{ color: '#1E293B' }}>{previewDoc.nombre}</p>
                <button onClick={() => { setPreviewDoc(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} className="cursor-pointer" style={{ color: '#64748B' }}><X size={15} /></button>
              </div>
              {previewUrl ? (
                previewDoc.mime_type.startsWith('image/') ? <img src={previewUrl} alt={previewDoc.nombre} className="max-h-[48vh] w-full object-contain bg-slate-100" /> : <iframe src={previewUrl} title={previewDoc.nombre} className="h-[48vh] w-full" />
              ) : <div className="py-10 text-center text-sm" style={{ color: '#64748B' }}>Cargando vista previa...</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PrevencionPanel({ email, onLogout, onNavigateEmployee }: Props) {
  const [activeTab, setActiveTab] = useState<PrevTab>('empleados');
  const [showChangePassword, setShowChangePassword] = useState(false);

  const tabs: { id: PrevTab; label: string; icon: LucideIcon }[] = [
    { id: 'empleados',     label: 'Empleados y Tags',   icon: Users },
    { id: 'tags',          label: 'Tags PRL',             icon: Tag },
    { id: 'documentos',    label: 'Documentos PRL',      icon: FileText },
    { id: 'trazabilidad',  label: 'Trazabilidad',        icon: CheckCircle2 },
    { id: 'departamentos', label: 'Departamentos PRL',   icon: Building2 },
    { id: 'reconocimiento', label: 'Reconocimiento Medico', icon: HeartPulse },
    { id: 'vitaly',          label: 'Vitaly',                 icon: Activity },
    { id: 'ayuda',            label: 'Ayuda',                   icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #064E3B, #065F46)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateEmployee ?? onLogout}
              title="Volver al panel de empleado"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#A7F3D0' }}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Panel de Prevencion</h1>
              <p className="text-white/50 text-xs">Prevencion de Riesgos Laborales</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SocietySwitcher textColor="#A7F3D0" bgColor="rgba(255,255,255,0.08)" borderColor="rgba(255,255,255,0.1)" />
            {onNavigateEmployee && (
              <button
                onClick={onNavigateEmployee}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <UserCircle size={14} />
                <span>Mi perfil empleado</span>
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium">{email}</p>
              <p className="text-white/50 text-xs">Prevencion</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#A7F3D0', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <KeyRound size={14} />
              <span className="hidden sm:inline">Cambiar Contrasena</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Badge */}
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-8 w-fit" style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7' }}>
          <ShieldCheck size={16} style={{ color: '#065F46' }} />
          <span className="text-sm font-semibold" style={{ color: '#065F46' }}>
            Sesion con privilegios de Prevencion de Riesgos Laborales
          </span>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 p-1 rounded-xl mb-8 overflow-x-auto" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: isActive ? '#065F46' : 'transparent', color: isActive ? '#FFFFFF' : '#64748B' }}
              >
                <TabIcon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'empleados' && <EmpleadosTagsTab />}
        {activeTab === 'tags' && <TagsManager />}
        {activeTab === 'documentos' && <PrlDocsModule />}
        {activeTab === 'trazabilidad' && <TrazabilidadModule />}
        {activeTab === 'departamentos' && <DepartamentosPrlTab />}
        {activeTab === 'reconocimiento' && <ReconocimientoMedicoTab email={email} />}
        {activeTab === 'vitaly' && <VitalyTab />}
        {activeTab === 'ayuda' && <HelpPanel currentProfileName="Prevención" accentColor="#065F46" />}
      </div>
    </div>
  );
}

// ─── Empleados + Tags tab ────────────────────────────────────────────────────

type AssignedTag = TagType & { etiquetado_id: string };

function EmpleadosTagsTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSociedad, setFilterSociedad] = useState('');
  const [page, setPage] = useState(1);

  // expandedId → the employee panel currently open
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // per-employee assigned tags cache: id → tags[]
  const [tagCache, setTagCache] = useState<Record<string, AssignedTag[]>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  // selected tag ids (multi-select) per employee
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [documentsEmployee, setDocumentsEmployee] = useState<Empleado | null>(null);
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);
  const [uploadingEmployeeId, setUploadingEmployeeId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, socRes, tagRes] = await Promise.all([
        supabase.from('empleados').select('*').order('nombre'),
        supabase.from('sociedades').select('*').order('nombre'),
        supabase.from('tags').select('*').order('nombre'),
      ]);
      if (empRes.error) throw new Error(`empleados: ${empRes.error.message}`);
      if (socRes.error) throw new Error(`sociedades: ${socRes.error.message}`);
      if (tagRes.error) throw new Error(`tags: ${tagRes.error.message}`);
      setEmpleados(empRes.data ?? []);
      setSociedades(socRes.data ?? []);
      setTags(tagRes.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [searchQuery, filterSociedad]);

  const loadDetail = useCallback(async (empleadoId: string) => {
    setLoadingDetail(true);
    try {
      const { data, error: err } = await supabase
        .from('etiquetado')
        .select('*, tags(id, nombre, created_at)')
        .eq('entidad_id', empleadoId);
      if (err) throw err;
      const tgs = ((data ?? []) as any[]).map((et: any) => ({
        id: et.tags?.id ?? et.tag_id,
        nombre: et.tags?.nombre ?? '',
        created_at: et.tags?.created_at ?? '',
        etiquetado_id: et.id,
      }));
      setTagCache((prev) => ({ ...prev, [empleadoId]: tgs as AssignedTag[] }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar etiquetas');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const expand = (empleadoId: string) => {
    if (expandedId === empleadoId) {
      setExpandedId(null);
      setSelectedTagIds(new Set());
      return;
    }
    setExpandedId(empleadoId);
    setSelectedTagIds(new Set());
    loadDetail(empleadoId);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  };

  const handleAssignSelected = async (empleadoId: string) => {
    if (selectedTagIds.size === 0) { setError('Selecciona al menos un tag'); return; }
    setSaving(true);
    setError(null);
    try {
      const rows = Array.from(selectedTagIds).map((tag_id) => ({ entidad_id: empleadoId, tag_id }));
      const { error: err } = await supabase.from('etiquetado').insert(rows);
      if (err) throw err;
      setSelectedTagIds(new Set());
      await loadDetail(empleadoId);
      showSuccess(`${rows.length} tag${rows.length > 1 ? 's' : ''} asignado${rows.length > 1 ? 's' : ''} correctamente`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar tags');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = async (etiquetadoId: string, empleadoId: string) => {
    try {
      const { error: err, count } = await supabase
        .from('etiquetado')
        .delete({ count: 'exact' })
        .eq('id', etiquetadoId);
      if (err) throw new Error(`RLS/DB: ${err.message} (code: ${err.code})`);
      if (count === 0) throw new Error(`No se encontró el registro (id: ${etiquetadoId}). Puede ser un problema de permisos.`);
      await loadDetail(empleadoId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar tag');
    }
  };

  const handleUploadPrevencionDoc = async (emp: Empleado, file: File) => {
    if (!emp.user_id) { setError('Este empleado no tiene usuario vinculado.'); return; }
    setUploadingEmployeeId(emp.id);
    setError(null);
    try {
      const path = `empleados/${emp.user_id}/prevencion/${Date.now()}-${file.name}`;
      await uploadToWasabi(file, path);
      const { error: insertError } = await supabase.from('employee_documents').insert({
        employee_id: emp.user_id,
        society_id: emp.id_sociedad ?? '',
        folder: 'prevencion',
        nombre: file.name,
        storage_path: path,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        subido_por_nombre: 'Prevencion',
      });
      if (insertError) throw new Error(insertError.message);
      setSuccess(`Documento "${file.name}" subido a la carpeta Prevencion de ${emp.nombre}.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al subir el documento.');
    } finally {
      setUploadingEmployeeId(null);
    }
  };

  const getSociedad = (id: string) => sociedades.find((s) => s.id === id);

  const filtered = empleados.filter((e) => {
    if (filterSociedad && e.id_sociedad !== filterSociedad) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.nombre.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q) || (e.puesto?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });
  const EMPLOYEES_PAGE_SIZE = 30;
  const employeeTotalPages = totalPages(filtered.length, EMPLOYEES_PAGE_SIZE);
  const safePage = Math.min(page, employeeTotalPages);
  const pagedEmpleados = paginate(filtered, safePage, EMPLOYEES_PAGE_SIZE);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          <AlertCircle size={16} /><span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto cursor-pointer"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46' }}>
          <CheckCircle2 size={16} /><span>{success}</span>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {/* Header */}
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: '#065F46' }} />
            <h3 className="font-semibold" style={{ color: '#0F172A' }}>Asignacion de Tags de Prevencion</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1" style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Buscar empleado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: '200px' }}
              />
            </div>
            <select
              value={filterSociedad}
              onChange={(e) => setFilterSociedad(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
            >
              <option value="">Todas las sociedades</option>
              {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="px-6 py-12 text-center">
            <RefreshCw size={20} className="animate-spin mx-auto mb-3" style={{ color: '#94A3B8' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>Cargando empleados...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>No se encontraron empleados</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {pagedEmpleados.map((emp) => {
              const soc = getSociedad(emp.id_sociedad ?? '');
              const isExpanded = expandedId === emp.id;
              const assignedTags = tagCache[emp.id] ?? [];
              const assignedTagIds = new Set(assignedTags.map((t) => t.id));
              // tags not yet assigned to this employee
              const availableTags = tags.filter((t) => !assignedTagIds.has(t.id));

              return (
                <div key={emp.id}>
                  {/* Row */}
                  <div
                    className="px-6 py-4 flex items-center gap-4 transition-colors duration-150 cursor-pointer hover:bg-slate-50"
                    onClick={() => expand(emp.id)}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: isExpanded ? '#065F46' : '#ECFDF5', color: isExpanded ? '#FFFFFF' : '#065F46' }}>
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {emp.puesto && <p className="text-xs font-medium" style={{ color: '#64748B' }}>{emp.puesto}</p>}
                        {emp.email && <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.email}</p>}
                      </div>
                    </div>
                    {/* tag count badge when collapsed */}
                    {!isExpanded && tagCache[emp.id] && tagCache[emp.id].length > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                        {tagCache[emp.id].length} tag{tagCache[emp.id].length > 1 ? 's' : ''}
                      </span>
                    )}
                    {soc && (
                      <span className="hidden sm:inline text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0"
                        style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                        {soc.nombre}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <label
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:opacity-80"
                        style={{ backgroundColor: uploadingEmployeeId === emp.id ? '#F1F5F9' : '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46' }}
                        title="Subir documento a carpeta Prevencion"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {uploadingEmployeeId === emp.id ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                        <input
                          ref={(el) => { fileInputRefs.current[emp.id] = el; }}
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={uploadingEmployeeId === emp.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadPrevencionDoc(emp, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDocumentsEmployee(emp); setDocumentsRefreshKey((k) => k + 1); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}
                        title="Ver carpeta Prevencion"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: isExpanded ? '#ECFDF5' : '#F8FAFC', border: '1px solid #E2E8F0', color: isExpanded ? '#065F46' : '#94A3B8' }}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-4" style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                      {loadingDetail && !tagCache[emp.id] ? (
                        <div className="py-4 text-center">
                          <RefreshCw size={16} className="animate-spin mx-auto" style={{ color: '#94A3B8' }} />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          {/* Left: assigned tags */}
                          <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#64748B' }}>
                              Tags asignados
                            </p>
                            {assignedTags.length === 0 ? (
                              <p className="text-xs" style={{ color: '#94A3B8' }}>Sin tags asignados</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {assignedTags.map((t) => {
                                  const tc = tagColor(t.nombre);
                                  return (
                                    <span key={t.etiquetado_id}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                                      style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                                      <Tag size={9} />
                                      {t.nombre}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveTag(t.etiquetado_id, emp.id); }}
                                        className="cursor-pointer hover:opacity-70 ml-0.5" style={{ color: tc.text }}>
                                        <X size={9} />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Right: multi-select checkboxes */}
                          <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
                                Asignar tags
                              </p>
                              {selectedTagIds.size > 0 && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                                  {selectedTagIds.size} seleccionado{selectedTagIds.size > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>

                            {availableTags.length === 0 ? (
                              <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>Todos los tags ya estan asignados</p>
                            ) : (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {availableTags.map((t) => {
                                  const tc = tagColor(t.nombre);
                                  const sel = selectedTagIds.has(t.id);
                                  return (
                                    <button
                                      key={t.id}
                                      onClick={(e) => { e.stopPropagation(); toggleTag(t.id); }}
                                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all duration-150"
                                      style={{
                                        backgroundColor: sel ? tc.text : tc.bg,
                                        color: sel ? '#FFFFFF' : tc.text,
                                        border: `2px solid ${sel ? tc.text : tc.border}`,
                                        transform: sel ? 'scale(1.05)' : 'scale(1)',
                                      }}
                                    >
                                      {sel
                                        ? <CheckCircle2 size={10} />
                                        : <Tag size={9} />}
                                      {t.nombre}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <button
                              onClick={(e) => { e.stopPropagation(); handleAssignSelected(emp.id); }}
                              disabled={saving || selectedTagIds.size === 0}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 transition-all duration-150"
                              style={{ backgroundColor: '#065F46', color: '#FFFFFF' }}
                            >
                              {saving
                                ? <RefreshCw size={12} className="animate-spin" />
                                : <Plus size={12} />}
                              Asignar{selectedTagIds.size > 1 ? ` ${selectedTagIds.size} tags` : ' tag'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Pagination
              page={safePage}
              totalPages={employeeTotalPages}
              totalItems={filtered.length}
              pageSize={EMPLOYEES_PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        )}
      </div>

      {/* Tag legend */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-2 mb-3">
          <Tag size={14} style={{ color: '#065F46' }} />
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Categorias de Riesgo Disponibles</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const tc = tagColor(t.nombre);
            return (
              <span key={t.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                <Tag size={9} />{t.nombre}
              </span>
            );
          })}
        </div>
      </div>

      {documentsEmployee && (
        <PrevencionDocumentsModal
          employeeId={documentsEmployee.user_id ?? documentsEmployee.id}
          employeeName={documentsEmployee.nombre}
          refreshKey={documentsRefreshKey}
          onClose={() => setDocumentsEmployee(null)}
        />
      )}
    </div>
  );
}

// ─── Departamentos PRL tab ───────────────────────────────────────────────────

interface DeptPrl {
  id: string;
  nombre: string;
  descripcion: string;
  society_id: string;
  created_at: string;
}

interface DeptEmpleado {
  id: string;           // empleados_departamentos_prl.id
  empleado_id: string;
  empleado_nombre: string;
  empleado_email: string;
}

function DepartamentosPrlTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [depts, setDepts] = useState<DeptPrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Per-dept expanded + employee assignment cache
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [deptEmpleados, setDeptEmpleados] = useState<Record<string, DeptEmpleado[]>>({});
  const [loadingDeptEmps, setLoadingDeptEmps] = useState(false);

  // Create / edit dept modal
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<DeptPrl | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formSociety, setFormSociety] = useState('');
  const [saving, setSaving] = useState(false);

  // Assign employee modal state
  const [assigningDeptId, setAssigningDeptId] = useState<string | null>(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depRes, empRes, socRes] = await Promise.all([
        supabase.from('departamentos_prl').select('*').order('nombre'),
        supabase.from('empleados').select('*').order('nombre'),
        supabase.from('sociedades').select('*').order('nombre'),
      ]);
      if (depRes.error) throw new Error(depRes.error.message);
      if (empRes.error) throw new Error(empRes.error.message);
      if (socRes.error) throw new Error(socRes.error.message);
      setDepts(depRes.data ?? []);
      setEmpleados(empRes.data ?? []);
      setSociedades(socRes.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadDeptEmpleados = async (deptId: string) => {
    setLoadingDeptEmps(true);
    const { data, error: err } = await supabase
      .from('empleados_departamentos_prl')
      .select('id, empleado_id, empleados(nombre, email)')
      .eq('departamento_prl_id', deptId);
    if (!err) {
      const rows: DeptEmpleado[] = (data ?? []).map((r: { id: string; empleado_id: string; empleados: { nombre: string; email: string }[] | null }) => ({
        id: r.id,
        empleado_id: r.empleado_id,
        empleado_nombre: r.empleados?.[0]?.nombre ?? '',
        empleado_email: r.empleados?.[0]?.email ?? '',
      }));
      setDeptEmpleados((prev) => ({ ...prev, [deptId]: rows }));
    }
    setLoadingDeptEmps(false);
  };

  const toggleExpand = (deptId: string) => {
    if (expandedDeptId === deptId) { setExpandedDeptId(null); return; }
    setExpandedDeptId(deptId);
    loadDeptEmpleados(deptId);
  };

  const openCreateForm = () => {
    setEditingDept(null);
    setFormNombre('');
    setFormDescripcion('');
    setFormSociety(sociedades[0]?.id ?? '');
    setShowForm(true);
  };

  const openEditForm = (dept: DeptPrl) => {
    setEditingDept(dept);
    setFormNombre(dept.nombre);
    setFormDescripcion(dept.descripcion);
    setFormSociety(dept.society_id);
    setShowForm(true);
  };

  const handleSaveDept = async () => {
    if (!formNombre.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingDept) {
        const { error: err } = await supabase
          .from('departamentos_prl')
          .update({ nombre: formNombre.trim(), descripcion: formDescripcion.trim(), society_id: formSociety })
          .eq('id', editingDept.id);
        if (err) throw err;
        flash('Departamento actualizado');
      } else {
        const { error: err } = await supabase
          .from('departamentos_prl')
          .insert({ nombre: formNombre.trim(), descripcion: formDescripcion.trim(), society_id: formSociety });
        if (err) throw err;
        flash('Departamento creado');
      }
      setShowForm(false);
      await loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = async (dept: DeptPrl) => {
    if (!confirm(`¿Eliminar el departamento "${dept.nombre}"? Se desvincularán todos los empleados.`)) return;
    try {
      const { error: err } = await supabase.from('departamentos_prl').delete().eq('id', dept.id);
      if (err) throw err;
      flash('Departamento eliminado');
      if (expandedDeptId === dept.id) setExpandedDeptId(null);
      await loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const handleRemoveEmpleado = async (assignId: string, deptId: string) => {
    try {
      const { error: err } = await supabase.from('empleados_departamentos_prl').delete().eq('id', assignId);
      if (err) throw err;
      await loadDeptEmpleados(deptId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al desvincular');
    }
  };

  const openAssign = (deptId: string) => {
    setAssigningDeptId(deptId);
    setSelectedEmpIds(new Set());
    setAssignSearch('');
  };

  const handleAssign = async () => {
    if (!assigningDeptId || selectedEmpIds.size === 0) return;
    setAssigning(true);
    try {
      const rows = Array.from(selectedEmpIds).map((eid) => ({
        empleado_id: eid,
        departamento_prl_id: assigningDeptId,
      }));
      const { error: err } = await supabase.from('empleados_departamentos_prl').insert(rows);
      if (err) throw err;
      flash(`${rows.length} empleado${rows.length > 1 ? 's' : ''} vinculado${rows.length > 1 ? 's' : ''}`);
      setAssigningDeptId(null);
      await loadDeptEmpleados(assigningDeptId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar');
    } finally {
      setAssigning(false);
    }
  };

  const getSociedad = (id: string) => sociedades.find((s) => s.id === id);

  return (
    <div className="space-y-5">
      {/* Toast */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          <AlertCircle size={15} /><span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46' }}>
          <CheckCircle2 size={15} /><span>{success}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Departamentos PRL</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            Agrupa empleados por departamento para asignarles documentos de prevención independientemente de las incidencias.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer hover:opacity-90 transition-all"
          style={{ backgroundColor: '#065F46' }}
        >
          <Plus size={15} /> Nuevo departamento
        </button>
      </div>

      {/* Create / Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #064E3B, #065F46)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <Building2 size={16} className="text-white" />
                </div>
                <h2 className="text-white font-semibold text-sm">{editingDept ? 'Editar departamento' : 'Nuevo departamento PRL'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Nombre *</label>
                <input autoFocus type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Mantenimiento" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Descripcion</label>
                <input type="text" value={formDescripcion} onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Breve descripcion" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Sociedad</label>
                <select value={formSociety} onChange={(e) => setFormSociety(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}>
                  {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleSaveDept} disabled={saving || !formNombre.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#065F46' }}>
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Building2 size={14} />}
                  {editingDept ? 'Guardar cambios' : 'Crear departamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign employees modal */}
      {assigningDeptId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #064E3B, #065F46)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <Users size={16} className="text-white" />
                </div>
                <h2 className="text-white font-semibold text-sm">
                  Añadir empleados — {depts.find((d) => d.id === assigningDeptId)?.nombre}
                </h2>
              </div>
              <button onClick={() => setAssigningDeptId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>Selecciona los empleados a vincular. Los ya asignados no aparecen.</p>
              {/* Search */}
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Buscar empleado..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
                  autoFocus
                />
                {assignSearch && (
                  <button onClick={() => setAssignSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {empleados
                  .filter((e) => {
                    if ((deptEmpleados[assigningDeptId] ?? []).some((de) => de.empleado_id === e.id)) return false;
                    if (!assignSearch.trim()) return true;
                    const q = assignSearch.toLowerCase();
                    return e.nombre.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q) || (e.dni ?? '').toLowerCase().includes(q);
                  })
                  .map((emp) => {
                    const sel = selectedEmpIds.has(emp.id);
                    return (
                      <button key={emp.id} onClick={() => setSelectedEmpIds((prev) => { const n = new Set(prev); sel ? n.delete(emp.id) : n.add(emp.id); return n; })}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                        style={{ border: `1.5px solid ${sel ? '#065F46' : '#E2E8F0'}`, backgroundColor: sel ? '#ECFDF5' : '#F8FAFC' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: sel ? '#065F46' : '#E2E8F0', color: sel ? '#FFFFFF' : '#94A3B8' }}>
                          {emp.nombre.charAt(0)}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-xs" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.email}</p>
                        </div>
                        {sel && <CheckCircle2 size={14} style={{ color: '#065F46', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                {empleados.filter((e) => {
                  if ((deptEmpleados[assigningDeptId] ?? []).some((de) => de.empleado_id === e.id)) return false;
                  if (!assignSearch.trim()) return true;
                  const q = assignSearch.toLowerCase();
                  return e.nombre.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q) || (e.dni ?? '').toLowerCase().includes(q);
                }).length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>
                    {assignSearch.trim() ? 'Sin resultados para esta busqueda' : 'Todos los empleados ya estan asignados'}
                  </p>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setAssigningDeptId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleAssign} disabled={assigning || selectedEmpIds.size === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#065F46' }}>
                  {assigning ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  Vincular {selectedEmpIds.size > 0 ? selectedEmpIds.size : ''} empleado{selectedEmpIds.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dept list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
      ) : depts.length === 0 ? (
        <div className="flex flex-col items-center py-20 rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ECFDF5' }}>
            <Building2 size={32} style={{ color: '#6EE7B7' }} />
          </div>
          <p className="text-base font-semibold" style={{ color: '#1E293B' }}>Sin departamentos PRL</p>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Crea departamentos para agrupar empleados por área de prevención</p>
          <button onClick={openCreateForm} className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ backgroundColor: '#065F46' }}>
            <Plus size={14} /> Crear primer departamento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {depts.map((dept) => {
            const isOpen = expandedDeptId === dept.id;
            const members = deptEmpleados[dept.id] ?? [];
            const soc = getSociedad(dept.society_id);
            return (
              <div key={dept.id} className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{ backgroundColor: '#FFFFFF', border: `1px solid ${isOpen ? '#6EE7B7' : '#E2E8F0'}` }}>
                {/* Header row */}
                <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors duration-150"
                  onClick={() => toggleExpand(dept.id)}
                  style={{ backgroundColor: isOpen ? '#F0FDF9' : undefined }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isOpen ? '#065F46' : '#ECFDF5', border: `1px solid ${isOpen ? '#065F46' : '#6EE7B7'}` }}>
                    <Building2 size={18} style={{ color: isOpen ? '#FFFFFF' : '#065F46' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{dept.nombre}</p>
                    {dept.descripcion && <p className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>{dept.descripcion}</p>}
                  </div>
                  {soc && (
                    <span className="hidden sm:inline text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0"
                      style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                      {soc.nombre}
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); openAssign(dept.id); loadDeptEmpleados(dept.id); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
                    style={{ backgroundColor: '#065F46', color: '#FFFFFF' }}>
                    <Plus size={11} /> Añadir
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openEditForm(dept); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                    style={{ color: '#CBD5E1' }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDept(dept); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-50 transition-colors"
                    style={{ color: '#CBD5E1' }}>
                    <Trash2 size={13} />
                  </button>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isOpen ? '#ECFDF5' : '#F8FAFC', border: '1px solid #E2E8F0', color: isOpen ? '#065F46' : '#94A3B8' }}>
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </div>
                </div>

                {/* Member list */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                    {loadingDeptEmps && !deptEmpleados[dept.id] ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
                      </div>
                    ) : members.length === 0 ? (
                      <div className="flex flex-col items-center py-10">
                        <Users size={28} className="mb-2" style={{ color: '#CBD5E1' }} />
                        <p className="text-sm" style={{ color: '#94A3B8' }}>Sin empleados asignados</p>
                        <button onClick={() => openAssign(dept.id)}
                          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                          style={{ backgroundColor: '#065F46', color: '#FFFFFF' }}>
                          <Plus size={12} /> Añadir empleados
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: '#E2E8F0' }}>
                        <div className="px-5 py-2.5">
                          <p className="text-xs" style={{ color: '#94A3B8' }}>{members.length} empleado{members.length !== 1 ? 's' : ''} en este departamento</p>
                        </div>
                        {members.map((m) => (
                          <div key={m.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white transition-colors duration-100">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                              {m.empleado_nombre.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{m.empleado_nombre}</p>
                              <p className="text-xs" style={{ color: '#94A3B8' }}>{m.empleado_email}</p>
                            </div>
                            <button onClick={() => handleRemoveEmpleado(m.id, dept.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-50 transition-colors"
                              title="Desvincular"
                              style={{ color: '#CBD5E1' }}>
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface HistorialEntry {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  anotacion: string;
  fecha_cita: string | null;
  created_by_email: string | null;
  created_at: string;
}

function ReconocimientoMedicoTab({ email }: { email: string }) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEstado, setEditEstado] = useState<'en_proceso' | 'finalizado' | null>(null);
  const [editAnotacion, setEditAnotacion] = useState('');
  const [editFechaCita, setEditFechaCita] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Record<string, HistorialEntry[]>>({});
  const [expandedHistorial, setExpandedHistorial] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('reconocimiento_medico', 'acepta')
      .order('nombre', { ascending: true });
    if (error) {
      console.error('Error loading reconocimientos:', error);
    } else {
      setEmpleados((data as Empleado[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [search]);

  const filtered = empleados.filter((e) => {
    const q = search.toLowerCase();
    return !q || e.nombre?.toLowerCase().includes(q) || e.dni?.toLowerCase().includes(q);
  });

  const RECOGNITION_PAGE_SIZE = 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / RECOGNITION_PAGE_SIZE));
  const paginated = filtered.slice(page * RECOGNITION_PAGE_SIZE, (page + 1) * RECOGNITION_PAGE_SIZE);

  const loadHistorial = useCallback(async (empleadoId: string) => {
    const { data, error: histError } = await supabase
      .from('reconocimiento_medico_historial')
      .select('*')
      .eq('empleado_id', empleadoId)
      .order('created_at', { ascending: false });
    if (!histError && data) {
      setHistorial((prev) => ({ ...prev, [empleadoId]: data as HistorialEntry[] }));
    }
  }, []);

  const handleEdit = (emp: Empleado) => {
    setEditingId(emp.id);
    setEditEstado((emp.reconocimiento_medico_estado as 'en_proceso' | 'finalizado' | null) ?? null);
    setEditAnotacion('');
    setEditFechaCita('');
    setError(null);
  };

  const handleSave = async (empId: string) => {
    setSaving(true);
    setError(null);

    const emp = empleados.find((e) => e.id === empId);
    const estadoAnterior = emp?.reconocimiento_medico_estado ?? null;

    const update: Record<string, unknown> = { reconocimiento_medico_estado: editEstado };
    if (editEstado === 'finalizado') {
      update.reconocimiento_medico_fecha = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('empleados')
      .update(update)
      .eq('id', empId);

    if (updateError) {
      console.error('Error updating estado:', updateError);
      setError('No se pudo actualizar el estado. Intenta de nuevo.');
      setSaving(false);
      return;
    }

    const { error: histError } = await supabase
      .from('reconocimiento_medico_historial')
      .insert({
        empleado_id: empId,
        estado_anterior: estadoAnterior,
        estado_nuevo: editEstado,
        anotacion: editAnotacion.trim() || null,
        fecha_cita: editFechaCita || null,
        created_by_email: email,
      });

    if (histError) {
      console.error('Error saving historial:', histError);
    }

    setEmpleados((prev) => prev.map((e) =>
      e.id === empId
        ? { ...e, reconocimiento_medico_estado: editEstado, reconocimiento_medico_fecha: editEstado === 'finalizado' ? new Date().toISOString() : e.reconocimiento_medico_fecha }
        : e
    ));

    await loadHistorial(empId);
    setEditingId(null);
    setSaving(false);
  };

  const toggleHistorial = async (empId: string) => {
    if (expandedHistorial === empId) {
      setExpandedHistorial(null);
    } else {
      setExpandedHistorial(empId);
      if (!historial[empId]) {
        await loadHistorial(empId);
      }
    }
  };

  const estadoBadge = (estado: string | null) => {
    if (estado === 'en_proceso') return { label: 'En proceso', color: '#B45309', bg: '#FEF3C7', border: '#F59E0B' };
    if (estado === 'finalizado') return { label: 'Finalizado', color: '#15803D', bg: '#DCFCE7', border: '#22C55E' };
    return { label: 'Pendiente', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
  };

  const estadoLabel = (estado: string | null) => {
    if (estado === 'en_proceso') return 'En proceso';
    if (estado === 'finalizado') return 'Finalizado';
    return 'Pendiente';
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#064E3B' }}>Reconocimiento Medico</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>Empleados que han aceptado el reconocimiento medico</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o DNI..."
          className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border outline-none"
          style={{ borderColor: '#D1D5DB', color: '#1E293B' }}
        />
      </div>

      {loading ? (
        <div className="text-center py-8" style={{ color: '#64748B' }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8" style={{ color: '#64748B' }}>
          <HeartPulse size={40} className="mx-auto mb-2 opacity-40" />
          <p>No hay empleados pendientes de reconocimiento medico</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((emp) => {
            const badge = estadoBadge(emp.reconocimiento_medico_estado);
            const isEditing = editingId === emp.id;
            const isHistorialExpanded = expandedHistorial === emp.id;
            const empHistorial = historial[emp.id] ?? [];
            return (
              <div key={emp.id} className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                      {emp.nombre?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#1E293B' }}>{emp.nombre} {emp.apellidos}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>{emp.dni || 'Sin DNI'}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                    {badge.label}
                  </span>
                </div>

                {isEditing ? (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Actualizar estado:</p>
                    <div className="flex gap-2 flex-wrap items-center mb-3">
                      {([
                        { value: 'en_proceso', label: 'En proceso', color: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
                        { value: 'finalizado', label: 'Finalizado', color: '#15803D', bg: '#DCFCE7', border: '#22C55E' },
                      ] as const).map(({ value, label, color, bg, border }) => {
                        const isActive = editEstado === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setEditEstado(value as 'en_proceso' | 'finalizado')}
                            className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                            style={{
                              backgroundColor: isActive ? bg : '#FFFFFF',
                              color: isActive ? color : '#94A3B8',
                              border: `1.5px solid ${isActive ? border : '#E2E8F0'}`,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mb-3">
                      <label className="text-xs font-semibold block mb-1" style={{ color: '#475569' }}>
                        Fecha de cita (opcional)
                      </label>
                      <input
                        type="date"
                        value={editFechaCita}
                        onChange={(e) => setEditFechaCita(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                        style={{ borderColor: '#D1D5DB', color: '#1E293B' }}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="text-xs font-semibold block mb-1" style={{ color: '#475569' }}>
                        Anotacion <span style={{ color: '#94A3B8' }}>(opcional)</span>
                      </label>
                      <textarea
                        value={editAnotacion}
                        onChange={(e) => setEditAnotacion(e.target.value)}
                        placeholder="Describe el motivo del cambio, la cita, el resultado..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                        style={{ borderColor: '#D1D5DB', color: '#1E293B' }}
                      />
                    </div>

                    {error && (
                      <p className="text-xs mb-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                        {error}
                      </p>
                    )}

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleSave(emp.id)}
                        disabled={saving}
                        className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#065F46', color: '#FFFFFF' }}
                      >
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setError(null); }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => toggleHistorial(emp.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                      style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}
                    >
                      <Activity size={13} /> {isHistorialExpanded ? 'Ocultar historial' : 'Ver historial'}
                      {empHistorial.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>
                          {empHistorial.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(emp)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                      style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}
                    >
                      <Edit2 size={13} /> Editar
                    </button>
                  </div>
                )}

                {emp.reconocimiento_medico_fecha && (
                  <p className="text-xs mt-2" style={{ color: '#64748B' }}>
                    Fecha: {new Date(emp.reconocimiento_medico_fecha).toLocaleDateString('es-ES')}
                  </p>
                )}

                {isHistorialExpanded && !isEditing && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                    {empHistorial.length === 0 ? (
                      <p className="text-xs text-center py-3" style={{ color: '#94A3B8' }}>
                        No hay cambios registrados en el historial.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {empHistorial.map((entry) => (
                          <div key={entry.id} className="relative pl-6">
                            <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.estado_nuevo === 'finalizado' ? '#22C55E' : '#F59E0B' }} />
                            {empHistorial.length > 1 && (
                              <div className="absolute left-[4.5px] top-4 bottom-[-12px] w-px" style={{ backgroundColor: '#E2E8F0' }} />
                            )}
                            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold" style={{ color: '#1E293B' }}>
                                  {estadoLabel(entry.estado_anterior)} → {estadoLabel(entry.estado_nuevo)}
                                </span>
                                <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                                  {new Date(entry.created_at).toLocaleString('es-ES')}
                                </span>
                              </div>
                              <p className="text-xs" style={{ color: '#475569' }}>{entry.anotacion || 'Sin anotacion'}</p>
                              {entry.fecha_cita && (
                                <p className="text-xs mt-1" style={{ color: '#0369A1' }}>
                                  Cita: {new Date(entry.fecha_cita).toLocaleDateString('es-ES')}
                                </p>
                              )}
                              {entry.created_by_email && (
                                <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
                                  Por: {entry.created_by_email}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: '#F1F5F9', color: '#0369A1', border: '1px solid #E2E8F0' }}
          >
            Anterior
          </button>
          <span className="text-sm" style={{ color: '#64748B' }}>
            Pagina {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: '#F1F5F9', color: '#0369A1', border: '1px solid #E2E8F0' }}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

// Exported icon for use in other components if needed
export { Upload };

// ============================================================
// Vitaly tab — manage Vitaly onboarding (Altas) and offboarding (Bajas) per employee
// ============================================================
type VitalyEstado = 'inactivo' | 'pendiente' | 'activo';

interface VitalyRow {
  id: string;
  nombre: string;
  dni: string | null;
  puesto: string | null;
  vitaly_estado: string;
  vitaly_motivo: string | null;
}

interface BajaVitalyRow {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  fecha_baja: string;
  motivo: string | null;
  comentario: string | null;
  estado: string;
  finalizada_at: string | null;
  created_at: string;
}

const VITALY_PAGE_SIZE = 30;

function VitalyTab() {
  const [subTab, setSubTab] = useState<'altas' | 'bajas'>('altas');
  const [rows, setRows] = useState<VitalyRow[]>([]);
  const [bajas, setBajas] = useState<BajaVitalyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEstado, setDraftEstado] = useState<VitalyEstado>('inactivo');
  const [draftMotivo, setDraftMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizingBajaId, setFinalizingBajaId] = useState<string | null>(null);
  const [bajaComentario, setBajaComentario] = useState('');
  const [savingBaja, setSavingBaja] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [empRes, bajaRes] = await Promise.all([
      supabase
        .from('empleados')
        .select('id, nombre, dni, puesto, vitaly_estado, vitaly_motivo')
        .in('vitaly_estado', ['inactivo', 'pendiente'])
        .order('nombre', { ascending: true }),
      supabase
        .from('bajas_vitaly')
        .select('id, empleado_id, empleado_nombre, fecha_baja, motivo, comentario, estado, finalizada_at, created_at')
        .order('created_at', { ascending: false }),
    ]);
    if (empRes.error) {
      setError(empRes.error.message);
      setRows([]);
    } else {
      setRows((empRes.data ?? []) as VitalyRow[]);
    }
    if (bajaRes.error) {
      setError(bajaRes.error.message);
      setBajas([]);
    } else {
      setBajas((bajaRes.data ?? []) as BajaVitalyRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [search]);

  const filtered = rows.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.nombre ?? '').toLowerCase().includes(q) ||
      (e.dni ?? '').toLowerCase().includes(q) ||
      (e.puesto ?? '').toLowerCase().includes(q)
    );
  });

  const filteredBajas = bajas.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.empleado_nombre ?? '').toLowerCase().includes(q) ||
      (b.motivo ?? '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / VITALY_PAGE_SIZE));
  const paginated = filtered.slice(page * VITALY_PAGE_SIZE, (page + 1) * VITALY_PAGE_SIZE);
  const bajasTotalPages = Math.max(1, Math.ceil(filteredBajas.length / VITALY_PAGE_SIZE));
  const bajasSafePage = Math.min(page, bajasTotalPages - 1);
  const paginatedBajas = filteredBajas.slice(bajasSafePage * VITALY_PAGE_SIZE, (bajasSafePage + 1) * VITALY_PAGE_SIZE);

  const startEdit = (row: VitalyRow) => {
    setEditingId(row.id);
    setDraftEstado((row.vitaly_estado as VitalyEstado) ?? 'inactivo');
    setDraftMotivo(row.vitaly_motivo ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftEstado('inactivo');
    setDraftMotivo('');
  };

  const save = async (row: VitalyRow) => {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = { vitaly_estado: draftEstado };
    if (draftEstado === 'pendiente') {
      payload.vitaly_motivo = draftMotivo.trim() || null;
    } else {
      payload.vitaly_motivo = null;
    }
    const { error: updError } = await supabase
      .from('empleados')
      .update(payload)
      .eq('id', row.id);
    if (updError) {
      setError(updError.message);
      setSaving(false);
      return;
    }
    if (draftEstado === 'activo') {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, vitaly_estado: draftEstado, vitaly_motivo: payload.vitaly_motivo as string | null }
            : r
        )
      );
    }
    cancelEdit();
    setSaving(false);
  };

  const finalizeBaja = async (baja: BajaVitalyRow) => {
    setSavingBaja(true);
    setError(null);
    try {
      const { error: updErr } = await supabase
        .from('bajas_vitaly')
        .update({
          estado: 'finalizada',
          finalizada_at: new Date().toISOString(),
          comentario: bajaComentario.trim() || null,
        })
        .eq('id', baja.id);
      if (updErr) throw updErr;
      setBajas((prev) =>
        prev.map((b) =>
          b.id === baja.id
            ? { ...b, estado: 'finalizada', finalizada_at: new Date().toISOString(), comentario: bajaComentario.trim() || null }
            : b
        )
      );
      setFinalizingBajaId(null);
      setBajaComentario('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al finalizar baja');
    } finally {
      setSavingBaja(false);
    }
  };

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return { label: 'Pendiente', color: '#B45309', bg: '#FEF3C7', border: '#F59E0B' };
      case 'activo':
        return { label: 'Activo', color: '#15803D', bg: '#DCFCE7', border: '#22C55E' };
      default:
        return { label: 'Inactivo', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
    }
  };

  const bajaEstadoBadge = (estado: string) => {
    if (estado === 'finalizada')
      return { label: 'Finalizada', color: '#15803D', bg: '#DCFCE7', border: '#22C55E' };
    return { label: 'Pendiente', color: '#B45309', bg: '#FEF3C7', border: '#F59E0B' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#0F172A' }}>Vitaly</h3>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Gestion de altas y bajas de empleados en Vitaly.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Sub-tabs: Altas / Bajas */}
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
        <button
          onClick={() => setSubTab('altas')}
          className="px-4 py-2 text-xs font-semibold cursor-pointer transition-all duration-150"
          style={{
            backgroundColor: subTab === 'altas' ? '#065F46' : '#F8FAFC',
            color: subTab === 'altas' ? '#FFFFFF' : '#64748B',
          }}
        >
          <Activity className="w-3.5 h-3.5 inline mr-1.5" />
          Altas Vitaly
        </button>
        <button
          onClick={() => setSubTab('bajas')}
          className="px-4 py-2 text-xs font-semibold cursor-pointer transition-all duration-150"
          style={{
            backgroundColor: subTab === 'bajas' ? '#B91C1C' : '#F8FAFC',
            color: subTab === 'bajas' ? '#FFFFFF' : '#64748B',
          }}
        >
          <XCircle className="w-3.5 h-3.5 inline mr-1.5" />
          Bajas Vitaly
          {bajas.filter((b) => b.estado === 'pendiente').length > 0 && (
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: subTab === 'bajas' ? 'rgba(255,255,255,0.25)' : '#FEE2E2', color: subTab === 'bajas' ? '#FFFFFF' : '#B91C1C' }}
            >
              {bajas.filter((b) => b.estado === 'pendiente').length}
            </span>
          )}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, DNI o puesto..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FECACA' }}>
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#B91C1C' }} />
          <p className="text-sm" style={{ color: '#B91C1C' }}>{error}</p>
        </div>
      )}

      {/* ─── Altas sub-tab ─── */}
      {subTab === 'altas' && (
        <>
          {loading ? (
            <p className="text-sm" style={{ color: '#64748B' }}>Cargando empleados...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: '#CBD5E1' }} />
              <p className="text-sm" style={{ color: '#64748B' }}>No hay empleados pendientes de Vitaly</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginated.map((emp) => {
                const badge = estadoBadge(emp.vitaly_estado);
                const isEditing = editingId === emp.id;
                return (
                  <div
                    key={emp.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold" style={{ color: '#0F172A' }}>
                            {emp.nombre}
                          </p>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs flex-wrap" style={{ color: '#64748B' }}>
                          {emp.dni && <span>DNI: {emp.dni}</span>}
                          {emp.puesto && <span>Puesto: {emp.puesto}</span>}
                        </div>
                        {emp.vitaly_motivo && !isEditing && (
                          <p className="text-xs mt-1" style={{ color: '#475569' }}>
                            Motivo: {emp.vitaly_motivo}
                          </p>
                        )}
                      </div>

                      {!isEditing && (
                        <button
                          onClick={() => startEdit(emp)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: '#F1F5F9', color: '#0369A1', border: '1px solid #E2E8F0' }}
                        >
                          Gestionar
                        </button>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E2E8F0' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Cambiar estado de Vitaly</p>
                        <div className="flex gap-2 flex-wrap mb-3">
                          {([
                            { value: 'inactivo', label: 'Inactivo', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
                            { value: 'pendiente', label: 'Pendiente', color: '#B45309', bg: '#FEF3C7', border: '#F59E0B' },
                            { value: 'activo', label: 'Activo', color: '#15803D', bg: '#DCFCE7', border: '#22C55E' },
                          ] as const).map(({ value, label, color, bg, border }) => {
                            const isActive = draftEstado === value;
                            return (
                              <button
                                key={value}
                                onClick={() => setDraftEstado(value as VitalyEstado)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                                style={{
                                  backgroundColor: isActive ? bg : '#FFFFFF',
                                  color: isActive ? color : '#94A3B8',
                                  border: `1.5px solid ${isActive ? border : '#E2E8F0'}`,
                                }}
                              >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? border : '#CBD5E1' }} />
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        {draftEstado === 'pendiente' && (
                          <div className="mb-3">
                            <label className="text-xs font-medium block mb-1" style={{ color: '#64748B' }}>
                              Motivo (obligatorio)
                            </label>
                            <textarea
                              value={draftMotivo}
                              onChange={(e) => setDraftMotivo(e.target.value)}
                              placeholder="Ej: pendiente de crear puesto..."
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg text-sm"
                              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                            />
                          </div>
                        )}

                        {draftEstado === 'activo' && (
                          <p className="text-xs mb-3" style={{ color: '#15803D' }}>
                            Al activar, el empleado desaparecera de esta lista y aparecera como activo en Empleados.
                          </p>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => save(emp)}
                            disabled={saving || (draftEstado === 'pendiente' && !draftMotivo.trim())}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                            style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
                          >
                            {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 rounded-lg text-sm font-medium"
                            style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Bajas sub-tab ─── */}
      {subTab === 'bajas' && (
        <>
          {loading ? (
            <p className="text-sm" style={{ color: '#64748B' }}>Cargando bajas...</p>
          ) : filteredBajas.length === 0 ? (
            <div className="text-center py-10 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <XCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#CBD5E1' }} />
              <p className="text-sm" style={{ color: '#64748B' }}>No hay bajas registradas en Vitaly</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedBajas.map((baja) => {
                const badge = bajaEstadoBadge(baja.estado);
                const isFinalizing = finalizingBajaId === baja.id;
                const isFinalizada = baja.estado === 'finalizada';
                return (
                  <div
                    key={baja.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold" style={{ color: '#0F172A' }}>
                            {baja.empleado_nombre}
                          </p>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs flex-wrap" style={{ color: '#64748B' }}>
                          <span>Fecha baja: {new Date(baja.fecha_baja).toLocaleDateString('es-ES')}</span>
                          <span>Creada: {new Date(baja.created_at).toLocaleDateString('es-ES')}</span>
                        </div>
                        {baja.motivo && (
                          <p className="text-xs mt-1" style={{ color: '#475569' }}>
                            Motivo: {baja.motivo}
                          </p>
                        )}
                        {baja.comentario && (
                          <p className="text-xs mt-1" style={{ color: '#065F46' }}>
                            Comentario: {baja.comentario}
                          </p>
                        )}
                        {isFinalizada && baja.finalizada_at && (
                          <p className="text-xs mt-1" style={{ color: '#15803D' }}>
                            Finalizada: {new Date(baja.finalizada_at).toLocaleDateString('es-ES')}
                          </p>
                        )}
                      </div>

                      {!isFinalizing && !isFinalizada && (
                        <button
                          onClick={() => { setFinalizingBajaId(baja.id); setBajaComentario(baja.comentario ?? ''); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}
                        >
                          Finalizar
                        </button>
                      )}
                    </div>

                    {isFinalizing && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E2E8F0' }}>
                        <label className="text-xs font-medium block mb-1" style={{ color: '#64748B' }}>
                          Comentario de finalizacion (opcional)
                        </label>
                        <textarea
                          value={bajaComentario}
                          onChange={(e) => setBajaComentario(e.target.value)}
                          placeholder="Anade un comentario al finalizar la baja..."
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg text-sm mb-3"
                          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => finalizeBaja(baja)}
                            disabled={savingBaja}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                            style={{ backgroundColor: '#15803D', color: '#FFFFFF' }}
                          >
                            {savingBaja ? 'Guardando...' : 'Confirmar finalizacion'}
                          </button>
                          <button
                            onClick={() => { setFinalizingBajaId(null); setBajaComentario(''); }}
                            className="px-4 py-2 rounded-lg text-sm font-medium"
                            style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
