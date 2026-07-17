import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Users, FileText, LogOut, Search, Plus, X, ChevronLeft, Tag, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Upload, RefreshCw, CircleUser as UserCircle, KeyRound, Building2, Trash2, CreditCard as Edit2, HeartPulse } from 'lucide-react';
import { supabase, type Empleado, type Sociedad, type Tag as TagType } from './supabaseClient';
import SocietySwitcher from './SocietySwitcher';
import PrlDocsModule from './components/PrlDocsModule';
import TrazabilidadModule from './components/TrazabilidadModule';
import ChangePasswordModal from './components/ChangePasswordModal';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateEmployee?: () => void;
}

type PrevTab = 'empleados' | 'documentos' | 'trazabilidad' | 'departamentos' | 'reconocimiento';

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

export default function PrevencionPanel({ email, onLogout, onNavigateEmployee }: Props) {
  const [activeTab, setActiveTab] = useState<PrevTab>('empleados');
  const [showChangePassword, setShowChangePassword] = useState(false);

  const tabs: { id: PrevTab; label: string; icon: React.FC<{ size?: number }> }[] = [
    { id: 'empleados',     label: 'Empleados y Tags',   icon: Users },
    { id: 'documentos',    label: 'Documentos PRL',      icon: FileText },
    { id: 'trazabilidad',  label: 'Trazabilidad',        icon: CheckCircle2 },
    { id: 'departamentos', label: 'Departamentos PRL',   icon: Building2 },
    { id: 'reconocimiento', label: 'Reconocimiento Medico', icon: HeartPulse },
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
        {activeTab === 'documentos' && <PrlDocsModule />}
        {activeTab === 'trazabilidad' && <TrazabilidadModule />}
        {activeTab === 'departamentos' && <DepartamentosPrlTab />}
        {activeTab === 'reconocimiento' && <ReconocimientoMedicoTab />}
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

  // expandedId → the employee panel currently open
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // per-employee assigned tags cache: id → tags[]
  const [tagCache, setTagCache] = useState<Record<string, AssignedTag[]>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  // selected tag ids (multi-select) per employee
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

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

  const loadDetail = useCallback(async (empleadoId: string) => {
    setLoadingDetail(true);
    try {
      const { data, error: err } = await supabase
        .from('etiquetado')
        .select('*, tags(id, nombre, created_at)')
        .eq('entidad_id', empleadoId);
      if (err) throw err;
      const tgs: AssignedTag[] = (data ?? []).map((et: { id: string; tag_id: string; entidad_id: string; created_at: string; tags: TagType | null }) => ({
        id: et.tags?.id ?? et.tag_id,
        nombre: et.tags?.nombre ?? '',
        created_at: et.tags?.created_at ?? '',
        etiquetado_id: et.id,
      }));
      setTagCache((prev) => ({ ...prev, [empleadoId]: tgs }));
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

  const getSociedad = (id: string) => sociedades.find((s) => s.id === id);

  const filtered = empleados.filter((e) => {
    if (filterSociedad && e.id_sociedad !== filterSociedad) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.nombre.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || (e.puesto?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

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
            {filtered.map((emp) => {
              const soc = getSociedad(emp.id_sociedad);
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
      const rows: DeptEmpleado[] = (data ?? []).map((r: { id: string; empleado_id: string; empleados: { nombre: string; email: string } | null }) => ({
        id: r.id,
        empleado_id: r.empleado_id,
        empleado_nombre: r.empleados?.nombre ?? '',
        empleado_email: r.empleados?.email ?? '',
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
                    return e.nombre.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || (e.dni ?? '').toLowerCase().includes(q);
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
                  return e.nombre.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || (e.dni ?? '').toLowerCase().includes(q);
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

function ReconocimientoMedicoTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEstado, setEditEstado] = useState<'en_proceso' | 'finalizado' | null>(null);
  const [saving, setSaving] = useState(false);

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

  const filtered = empleados.filter((e) => {
    const q = search.toLowerCase();
    return !q || e.nombre?.toLowerCase().includes(q) || e.dni?.toLowerCase().includes(q);
  });

  const handleEdit = (emp: Empleado) => {
    setEditingId(emp.id);
    setEditEstado(emp.reconocimiento_medico_estado ?? null);
  };

  const handleSave = async (empId: string) => {
    setSaving(true);
    const update: Record<string, unknown> = { reconocimiento_medico_estado: editEstado };
    if (editEstado === 'finalizado') {
      update.reconocimiento_medico_fecha = new Date().toISOString();
    }
    const { error } = await supabase
      .from('empleados')
      .update(update)
      .eq('id', empId);
    if (error) {
      console.error('Error updating estado:', error);
    } else {
      setEmpleados((prev) => prev.map((e) =>
        e.id === empId
          ? { ...e, reconocimiento_medico_estado: editEstado, reconocimiento_medico_fecha: editEstado === 'finalizado' ? new Date().toISOString() : e.reconocimiento_medico_fecha }
          : e
      ));
      setEditingId(null);
    }
    setSaving(false);
  };

  const estadoBadge = (estado: string | null) => {
    if (estado === 'en_proceso') return { label: 'En proceso', color: '#B45309', bg: '#FEF3C7', border: '#F59E0B' };
    if (estado === 'finalizado') return { label: 'Finalizado', color: '#15803D', bg: '#DCFCE7', border: '#22C55E' };
    return { label: 'Pendiente', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
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
          {filtered.map((emp) => {
            const badge = estadoBadge(emp.reconocimiento_medico_estado);
            const isEditing = editingId === emp.id;
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
                    <div className="flex gap-2 flex-wrap items-center">
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
                      <button
                        onClick={() => handleSave(emp.id)}
                        disabled={saving}
                        className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#065F46', color: '#FFFFFF' }}
                      >
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-end">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Exported icon for use in other components if needed
export { Upload };
