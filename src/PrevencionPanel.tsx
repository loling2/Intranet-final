import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Users, FileText, LogOut, Search, Plus, X,
  ChevronLeft, Tag, ChevronDown, ChevronUp, AlertCircle,
  CheckCircle2, Upload, RefreshCw,
} from 'lucide-react';
import { supabase, type Empleado, type Sociedad, type Tag as TagType } from './supabaseClient';
import SocietySwitcher from './SocietySwitcher';
import DocumentsModule from './DocumentsModule';

interface Props {
  email: string;
  onLogout: () => void;
}

type PrevTab = 'empleados' | 'documentos';

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

export default function PrevencionPanel({ email, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<PrevTab>('empleados');

  const tabs: { id: PrevTab; label: string; icon: React.FC<{ size?: number }> }[] = [
    { id: 'empleados',  label: 'Empleados y Tags',   icon: Users },
    { id: 'documentos', label: 'Documentos PRL',      icon: FileText },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #064E3B, #065F46)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              title="Volver al inicio"
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
        {activeTab === 'documentos' && <DocumentsModule currentUserRole="prevencion" userEmail={email} />}
      </div>
    </div>
  );
}

// ─── Empleados + Tags tab ────────────────────────────────────────────────────

function EmpleadosTagsTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSociedad, setFilterSociedad] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [empleadoTags, setEmpleadoTags] = useState<(TagType & { etiquetado_id: string })[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newTagId, setNewTagId] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, socRes, tagRes] = await Promise.all([
        supabase.from('empleados').select('*').order('nombre'),
        supabase.from('sociedades').select('*').order('nombre'),
        supabase.from('tags').select('*').order('nombre'),
      ]);
      if (empRes.error) throw empRes.error;
      if (socRes.error) throw socRes.error;
      if (tagRes.error) throw tagRes.error;
      setEmpleados(empRes.data ?? []);
      setSociedades(socRes.data ?? []);
      setTags(tagRes.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
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
      const tgs = (data ?? []).map((et: { id: string; tag_id: string; entidad_id: string; created_at: string; tags: TagType | null }) => ({
        id: et.tags?.id ?? et.tag_id,
        nombre: et.tags?.nombre ?? '',
        created_at: et.tags?.created_at ?? '',
        etiquetado_id: et.id,
      }));
      setEmpleadoTags(tgs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar etiquetas');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (expandedId) loadDetail(expandedId);
  }, [expandedId, loadDetail]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleAddTag = async (empleadoId: string) => {
    if (!newTagId) { setError('Selecciona un tag'); return; }
    setSavingDetail(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('etiquetado').insert({ entidad_id: empleadoId, tag_id: newTagId });
      if (err) throw err;
      setNewTagId('');
      await loadDetail(empleadoId);
      showSuccess('Tag de prevencion asignado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar tag');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleRemoveTag = async (etiquetadoId: string, empleadoId: string) => {
    setSavingDetail(true);
    try {
      const { error: err } = await supabase.from('etiquetado').delete().eq('id', etiquetadoId);
      if (err) throw err;
      await loadDetail(empleadoId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar tag');
    } finally {
      setSavingDetail(false);
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
              return (
                <div key={emp.id}>
                  <div className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors duration-150">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {emp.puesto && <p className="text-xs font-medium" style={{ color: '#64748B' }}>{emp.puesto}</p>}
                        {emp.email && <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.email}</p>}
                      </div>
                    </div>
                    {soc && (
                      <span className="hidden sm:inline text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0"
                        style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                        {soc.nombre}
                      </span>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 flex-shrink-0"
                      style={{ backgroundColor: isExpanded ? '#ECFDF5' : '#F8FAFC', border: '1px solid #E2E8F0', color: isExpanded ? '#065F46' : '#94A3B8' }}
                      title="Gestionar tags"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Expanded tag panel */}
                  {isExpanded && (
                    <div className="px-6 pb-5 pt-3" style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                      {loadingDetail ? (
                        <div className="py-4 text-center">
                          <RefreshCw size={16} className="animate-spin mx-auto" style={{ color: '#94A3B8' }} />
                        </div>
                      ) : (
                        <div className="max-w-lg space-y-4">
                          {/* Current tags */}
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>
                              Tags de prevencion asignados
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {empleadoTags.length === 0 && (
                                <p className="text-xs" style={{ color: '#94A3B8' }}>Sin tags asignados</p>
                              )}
                              {empleadoTags.map((t) => {
                                const tc = tagColor(t.nombre);
                                return (
                                  <span key={t.etiquetado_id}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                                    style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                                    <Tag size={10} />
                                    {t.nombre}
                                    <button onClick={() => handleRemoveTag(t.etiquetado_id, emp.id)} disabled={savingDetail}
                                      className="cursor-pointer hover:opacity-70 ml-0.5" style={{ color: tc.text }}>
                                      <X size={10} />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Add tag */}
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>
                              Asignar nuevo tag
                            </p>
                            <div className="flex gap-2">
                              <select value={newTagId} onChange={(e) => setNewTagId(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
                                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
                                <option value="">Seleccionar categoria de riesgo...</option>
                                {tags
                                  .filter((t) => !empleadoTags.find((et) => et.id === t.id))
                                  .map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                              </select>
                              <button onClick={() => handleAddTag(emp.id)} disabled={savingDetail || !newTagId}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all duration-200"
                                style={{ backgroundColor: '#065F46', color: '#FFFFFF' }}>
                                {savingDetail ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                                Asignar
                              </button>
                            </div>
                            {/* Tag color preview */}
                            {newTagId && (() => {
                              const t = tags.find((t) => t.id === newTagId);
                              if (!t) return null;
                              const tc = tagColor(t.nombre);
                              return (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                                    style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                                    <Tag size={9} />{t.nombre}
                                  </span>
                                  <span className="text-xs" style={{ color: '#94A3B8' }}>se asignara al empleado</span>
                                </div>
                              );
                            })()}
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
        <div className="flex items-center gap-2 mb-4">
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

// Exported icon for use in other components if needed
export { Upload };
