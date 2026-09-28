import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Users, Calendar, Plus, X, Search, Building2, ChevronLeft, ChevronRight,
  LogOut, KeyRound, Clock, AlertCircle, User, Phone, Mail, FileText,
  FolderOpen, AlertTriangle,
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import SocietySwitcher from '../SocietySwitcher';
import ProfileSwitcher, { type ProfileOption } from './ProfileSwitcher';
import HelpPanel from './HelpPanel';
import CrmDocumentosModule from './CrmDocumentosModule';
import CrmIncidenciasModule from './CrmIncidenciasModule';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateEmployee?: () => void;
  availableProfiles?: ProfileOption[];
  onNavigateProfile?: (view: string) => void;
}

interface UsuarioServicio {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  observaciones: string | null;
  activo: boolean;
  centros?: { id: string; nombre: string }[];
}

interface CrmNota {
  id: string;
  usuario_servicio_id: string;
  fecha: string;
  autor_nombre: string;
  contenido: string;
  created_at: string;
}

interface CentroOption { id: string; nombre: string; }

type CrmTab = 'residentes' | 'incidencias' | 'ayuda';
type ResidentDetailTab = 'info' | 'calendario' | 'documentos';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

export default function CrmPanel({ email, onLogout, onNavigateEmployee, availableProfiles, onNavigateProfile }: Props) {
  const [activeTab, setActiveTab] = useState<CrmTab>('residentes');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentUserNombre, setCurrentUserNombre] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [detailTab, setDetailTab] = useState<ResidentDetailTab>('info');

  // Usuarios
  const [usuarios, setUsuarios] = useState<UsuarioServicio[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCentro, setFilterCentro] = useState<string>('');
  const [selectedUsuario, setSelectedUsuario] = useState<UsuarioServicio | null>(null);
  const [showUsuarioForm, setShowUsuarioForm] = useState(false);
  const [centros, setCentros] = useState<CentroOption[]>([]);

  // Calendario
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [notas, setNotas] = useState<CrmNota[]>([]);
  const [notasLoading, setNotasLoading] = useState(false);
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [notaFecha, setNotaFecha] = useState('');
  const [notaAutor, setNotaAutor] = useState('');
  const [notaContenido, setNotaContenido] = useState('');
  const [notaSaving, setNotaSaving] = useState(false);
  const [notaError, setNotaError] = useState('');
  const [filterFecha, setFilterFecha] = useState('');


  // Usuario form
  const [formNombre, setFormNombre] = useState('');
  const [formApellidos, setFormApellidos] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  const [formCentros, setFormCentros] = useState<string[]>([]);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      if (uid) {
        supabase.from('user_profiles').select('nombre, role').eq('id', uid).maybeSingle()
          .then(({ data }) => {
            const nombre = data?.nombre ?? email;
            setCurrentUserNombre(nombre);
            setNotaAutor(nombre);
            setIsAdmin((data as { role: string } | null)?.role === 'admin');
          });
      }
    });
  }, [email]);

  const loadCentros = useCallback(async () => {
    const { data } = await supabase.from('centros').select('id, nombre').order('nombre');
    setCentros((data ?? []) as CentroOption[]);
  }, []);

  const loadUsuarios = useCallback(async () => {
    setUsuariosLoading(true);
    // Non-admin users only see patients assigned to them
    const { data: rpcData } = await supabase.rpc('get_my_crm_pacientes');
    const usuariosData = (rpcData ?? []) as { id: string; nombre: string; apellidos: string | null; email: string | null; telefono: string | null; observaciones: string | null; activo: boolean }[];

    const userIds = usuariosData.map((u) => u.id);
    let centrosMap: Record<string, { id: string; nombre: string }[]> = {};
    if (userIds.length > 0) {
      const { data: asignaciones } = await supabase
        .from('usuarios_servicios_centros')
        .select('usuario_servicio_id, centro_id, centros(id, nombre)')
        .in('usuario_servicio_id', userIds);
      for (const row of (asignaciones ?? []) as { usuario_servicio_id: string; centros: { id: string; nombre: string } | null }[]) {
        const uid = row.usuario_servicio_id;
        const centro = row.centros;
        if (!centro) continue;
        if (!centrosMap[uid]) centrosMap[uid] = [];
        centrosMap[uid].push({ id: centro.id, nombre: centro.nombre });
      }
    }
    const usuariosWithCentros: UsuarioServicio[] = usuariosData.map((u) => ({
      id: u.id, nombre: u.nombre,
      apellidos: u.apellidos, email: u.email,
      telefono: u.telefono, observaciones: u.observaciones,
      activo: u.activo, centros: centrosMap[u.id] ?? [],
    }));
    setUsuarios(usuariosWithCentros);
    setUsuariosLoading(false);
  }, []);

  useEffect(() => { loadCentros(); loadUsuarios(); }, [loadCentros, loadUsuarios]);

  // Cargar notas del usuario seleccionado
  useEffect(() => {
    if (!selectedUsuario) { setNotas([]); return; }
    setNotasLoading(true);
    supabase.from('crm_notas')
      .select('id, usuario_servicio_id, fecha, autor_nombre, contenido, created_at')
      .eq('usuario_servicio_id', selectedUsuario.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { setNotas([]); } else { setNotas((data ?? []) as CrmNota[]); }
        setNotasLoading(false);
      });
  }, [selectedUsuario]);

  // === Usuario form ===
  const openNewUsuario = () => {
    setEditingId(null); setFormNombre(''); setFormApellidos(''); setFormEmail('');
    setFormTelefono(''); setFormObservaciones(''); setFormCentros([]); setFormError('');
    setShowUsuarioForm(true);
  };
  const openEditUsuario = (u: UsuarioServicio) => {
    setEditingId(u.id); setFormNombre(u.nombre); setFormApellidos(u.apellidos ?? '');
    setFormEmail(u.email ?? ''); setFormTelefono(u.telefono ?? '');
    setFormObservaciones(u.observaciones ?? '');
    setFormCentros(u.centros?.map((c) => c.id) ?? []); setFormError('');
    setShowUsuarioForm(true);
  };
  const handleSaveUsuario = async () => {
    if (!formNombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    setFormSaving(true); setFormError('');
    try {
      if (editingId) {
        const { error } = await supabase.from('usuarios_servicios').update({
          nombre: formNombre.trim(), apellidos: formApellidos.trim(), email: formEmail.trim(),
          telefono: formTelefono.trim(), observaciones: formObservaciones.trim(), updated_at: new Date().toISOString(),
        }).eq('id', editingId);
        if (error) throw error;
        await supabase.from('usuarios_servicios_centros').delete().eq('usuario_servicio_id', editingId);
        if (formCentros.length > 0) {
          await supabase.from('usuarios_servicios_centros').insert(formCentros.map((c) => ({ usuario_servicio_id: editingId, centro_id: c })));
        }
      } else {
        const { data, error } = await supabase.from('usuarios_servicios').insert({
          nombre: formNombre.trim(), apellidos: formApellidos.trim(), email: formEmail.trim(),
          telefono: formTelefono.trim(), observaciones: formObservaciones.trim(),
        }).select('id').single();
        if (error) throw error;
        if (formCentros.length > 0) {
          await supabase.from('usuarios_servicios_centros').insert(formCentros.map((c) => ({ usuario_servicio_id: data.id, centro_id: c })));
        }
      }
      setShowUsuarioForm(false); await loadUsuarios();
    } catch { setFormError('No se pudo guardar. Inténtalo de nuevo.'); }
    finally { setFormSaving(false); }
  };
  // === Calendario ===
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const todayISO = formatDateISO(new Date());
  const calendarCells: { date: Date | null; iso: string | null }[] = [];
  for (let i = 0; i < startOffset; i++) calendarCells.push({ date: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    calendarCells.push({ date, iso: formatDateISO(date) });
  }
  const notasByDate: Record<string, number> = {};
  for (const n of notas) notasByDate[n.fecha] = (notasByDate[n.fecha] ?? 0) + 1;
  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const goToday = () => setCalendarDate(new Date());
  const openNotaModal = (fechaISO: string) => { setNotaFecha(fechaISO); setNotaContenido(''); setNotaError(''); setShowNotaModal(true); };
  const handleSaveNota = async () => {
    if (!selectedUsuario) return;
    if (!notaAutor.trim()) { setNotaError('El nombre del autor es obligatorio'); return; }
    if (!notaContenido.trim()) { setNotaError('El contenido de la nota es obligatorio'); return; }
    setNotaSaving(true); setNotaError('');
    try {
      const { data, error } = await supabase.from('crm_notas').insert({
        usuario_servicio_id: selectedUsuario.id, fecha: notaFecha,
        autor_nombre: notaAutor.trim(), contenido: notaContenido.trim(),
      }).select('id, usuario_servicio_id, fecha, autor_nombre, contenido, created_at').single();
      if (error) throw error;
      setNotas((prev) => [data as CrmNota, ...prev]);
      setShowNotaModal(false); setNotaContenido('');
    } catch { setNotaError('No se pudo guardar la nota.'); }
    finally { setNotaSaving(false); }
  };
  const notasDisplay = filterFecha ? notas.filter((n) => n.fecha === filterFecha) : notas;

  const filteredUsuarios = usuarios.filter((u) => {
    if (filterCentro && !(u.centros ?? []).some((c) => c.id === filterCentro)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.nombre.toLowerCase().includes(q) || (u.apellidos ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
  });

  // Usuario seleccionado display
  const selectedUserLabel = selectedUsuario ? `${selectedUsuario.nombre} ${selectedUsuario.apellidos ?? ''}` : '';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {availableProfiles && onNavigateProfile ? (
              <ProfileSwitcher currentLabel="CRM" options={availableProfiles} onNavigate={onNavigateProfile} headerText="#E0F2FE" />
            ) : (
              <button onClick={onNavigateEmployee ?? onLogout} title="Volver"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all hover:opacity-80"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#E0F2FE' }}>
                <ChevronLeft size={16} />
              </button>
            )}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Users size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm sm:text-lg tracking-tight">Panel CRM</h1>
              <p className="text-white/50 text-xs hidden sm:block">Gestión de usuarios, notas y documentos</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <SocietySwitcher textColor="#E0F2FE" bgColor="rgba(255,255,255,0.08)" borderColor="rgba(255,255,255,0.1)" />
            {onNavigateEmployee && (
              <button onClick={onNavigateEmployee}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Users size={12} /><span>Mi perfil empleado</span>
              </button>
            )}
            <div className="text-right hidden lg:block">
              <p className="text-white text-xs font-medium truncate max-w-[140px]">{email}</p>
              <p className="text-white/50 text-xs">CRM</p>
            </div>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)' }}>
              <LogOut size={13} /><span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
            <button onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#E0F2FE', border: '1px solid rgba(255,255,255,0.12)' }}>
              <KeyRound size={13} /><span className="hidden lg:inline">Cambiar Contraseña</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Tabs */}
        <div className="md:hidden mb-6">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <select value={activeTab} onChange={(e) => setActiveTab(e.target.value as CrmTab)}
              className="flex-1 bg-transparent text-sm font-medium outline-none cursor-pointer" style={{ color: '#0F172A' }}>
              <option value="residentes">Residentes</option>
              <option value="incidencias">Incidencias</option>
              <option value="ayuda">Ayuda</option>
            </select>
          </div>
        </div>
        <div className="hidden md:flex flex-wrap gap-1 p-1 rounded-xl mb-6 sm:mb-8" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {([
            { id: 'residentes', label: 'Residentes', icon: Users },
            { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle },
            { id: 'ayuda', label: 'Ayuda', icon: AlertCircle },
          ] as const).map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedUsuario(null); }}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                style={{ backgroundColor: isActive ? '#0369A1' : 'transparent', color: isActive ? '#FFFFFF' : '#64748B' }}>
                <TabIcon size={13} />{tab.label}
              </button>
            );
          })}
        </div>

        {/* === Tab: Residentes (listado + ficha) === */}
        {activeTab === 'residentes' && (
          <div className="space-y-6">
            {!selectedUsuario ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Residentes</h2>
                    <p className="text-sm" style={{ color: '#64748B' }}>Pacientes asignados a centros</p>
                  </div>
                  {isAdmin && (
                    <button onClick={openNewUsuario}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                      style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                      <Plus size={14} />Nuevo residente
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <Search size={16} style={{ color: '#64748B' }} />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre, apellidos o email..."
                      className="flex-1 bg-transparent text-sm outline-none" style={{ color: '#0F172A' }} />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <Building2 size={16} style={{ color: '#64748B' }} />
                    <select value={filterCentro} onChange={(e) => setFilterCentro(e.target.value)}
                      className="bg-transparent text-sm outline-none cursor-pointer min-w-[140px]" style={{ color: '#0F172A' }}>
                      <option value="">Todos los centros</option>
                      {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>
                {usuariosLoading ? (
                  <div className="text-center py-12"><Clock size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /><p className="text-sm" style={{ color: '#64748B' }}>Cargando residentes...</p></div>
                ) : filteredUsuarios.length === 0 ? (
                  <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
                    <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay residentes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsuarios.map((u) => (
                      <div key={u.id} className="rounded-xl p-5 transition-all hover:shadow-md cursor-pointer" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        onClick={() => { setSelectedUsuario(u); setDetailTab('info'); }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                              <User size={22} style={{ color: '#0369A1' }} />
                            </div>
                            <div>
                              <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{u.nombre} {u.apellidos}</p>
                              <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: u.activo ? '#F0FDF4' : '#FEF2F2', color: u.activo ? '#16A34A' : '#DC2626' }}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                            </div>
                          </div>
                          <ChevronRight size={16} style={{ color: '#CBD5E1' }} />
                        </div>
                        <div className="space-y-1.5 mb-3">
                          {u.email && <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}><Mail size={12} /><span className="truncate">{u.email}</span></div>}
                          {u.telefono && <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}><Phone size={12} /><span>{u.telefono}</span></div>}
                        </div>
                        {u.centros && u.centros.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {u.centros.map((c) => <span key={c.id} className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}><Building2 size={10} className="inline mr-1" />{c.nombre}</span>)}
                          </div>
                        )}
                        {u.observaciones && <p className="text-xs mb-3 line-clamp-2" style={{ color: '#94A3B8' }}>{u.observaciones}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Ficha del residente */}
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => setSelectedUsuario(null)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                    style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                    <ChevronLeft size={14} /> Volver
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                      <User size={20} style={{ color: '#0369A1' }} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>{selectedUserLabel}</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: selectedUsuario.activo ? '#F0FDF4' : '#FEF2F2', color: selectedUsuario.activo ? '#16A34A' : '#DC2626' }}>{selectedUsuario.activo ? 'Activo' : 'Inactivo'}</span>
                        {selectedUsuario.centros && selectedUsuario.centros.map((c) => <span key={c.id} className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{c.nombre}</span>)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-pestañas de la ficha */}
                <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  {([
                    { id: 'info', label: 'Información', icon: User },
                    { id: 'calendario', label: 'Calendario y Notas', icon: Calendar },
                    { id: 'documentos', label: 'Documentos', icon: FolderOpen },
                  ] as const).map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = detailTab === tab.id;
                    return (
                      <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                        className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                        style={{ backgroundColor: isActive ? '#0369A1' : 'transparent', color: isActive ? '#FFFFFF' : '#64748B' }}>
                        <TabIcon size={13} />{tab.label}
                      </button>
                    );
                  })}
                  {isAdmin && (
                    <button onClick={() => openEditUsuario(selectedUsuario)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ml-auto"
                      style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                      Editar
                    </button>
                  )}
                </div>

                {/* Sub-pestaña: Información */}
                {detailTab === 'info' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <h3 className="font-semibold text-sm mb-4" style={{ color: '#0F172A' }}>Datos de contacto</h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><Mail size={16} style={{ color: '#0369A1' }} /></div>
                          <div><p className="text-xs" style={{ color: '#94A3B8' }}>Email</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{selectedUsuario.email || 'Sin email'}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><Phone size={16} style={{ color: '#0369A1' }} /></div>
                          <div><p className="text-xs" style={{ color: '#94A3B8' }}>Teléfono</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{selectedUsuario.telefono || 'Sin teléfono'}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><Building2 size={16} style={{ color: '#0369A1' }} /></div>
                          <div><p className="text-xs" style={{ color: '#94A3B8' }}>Centros</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{selectedUsuario.centros && selectedUsuario.centros.length > 0 ? selectedUsuario.centros.map(c => c.nombre).join(', ') : 'Sin centros'}</p></div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <h3 className="font-semibold text-sm mb-4" style={{ color: '#0F172A' }}>Observaciones</h3>
                      {selectedUsuario.observaciones ? (
                        <p className="text-sm" style={{ color: '#475569', lineHeight: 1.6 }}>{selectedUsuario.observaciones}</p>
                      ) : (
                        <p className="text-sm" style={{ color: '#94A3B8' }}>Sin observaciones</p>
                      )}
                      <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
                        <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>Resumen de actividad</p>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2"><Calendar size={14} style={{ color: '#0369A1' }} /><span className="text-sm font-medium" style={{ color: '#0F172A' }}>{notas.length} notas</span></div>
                          <button onClick={() => setDetailTab('calendario')} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Ver calendario</button>
                          <button onClick={() => setDetailTab('documentos')} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Ver documentos</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-pestaña: Calendario */}
                {detailTab === 'calendario' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{MONTH_NAMES[month]} {year}</h3>
                        <div className="flex items-center gap-1">
                          <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}><ChevronLeft size={16} /></button>
                          <button onClick={goToday} className="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Hoy</button>
                          <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}><ChevronRight size={16} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAY_NAMES.map((d) => <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: '#94A3B8' }}>{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {calendarCells.map((cell, i) => {
                          if (!cell.date || !cell.iso) return <div key={i} className="aspect-square" />;
                          const isToday = cell.iso === todayISO;
                          const notaCount = notasByDate[cell.iso] ?? 0;
                          const isFiltered = filterFecha === cell.iso;
                          return (
                            <button key={i} onClick={() => openNotaModal(cell.iso!)}
                              onContextMenu={(e) => { e.preventDefault(); setFilterFecha(isFiltered ? '' : cell.iso!); }}
                              className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs cursor-pointer transition-all relative"
                              style={{ backgroundColor: isFiltered ? '#0369A1' : isToday ? '#EFF6FF' : '#F8FAFC', color: isFiltered ? '#FFFFFF' : isToday ? '#0369A1' : '#475569', border: isToday ? '1px solid #BFDBFE' : '1px solid transparent' }}
                              title={`${formatDateDisplay(cell.iso)} — Click para añadir nota. Clic derecho para filtrar.`}>
                              <span className="font-medium">{cell.date!.getDate()}</span>
                              {notaCount > 0 && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isFiltered ? '#FFFFFF' : '#0369A1' }} />}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>Click para añadir nota · Clic derecho para filtrar por fecha</p>
                    </div>
                    <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><FileText size={16} style={{ color: '#0369A1' }} /><h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Historial de Notas</h3></div>
                        {filterFecha && <button onClick={() => setFilterFecha('')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}><X size={10} />Quitar filtro</button>}
                      </div>
                      <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}>
                        <AlertCircle size={14} style={{ color: '#D97706' }} />
                        <p className="text-xs" style={{ color: '#92400E' }}>Las notas son registros históricos de solo lectura. No se pueden editar ni borrar.</p>
                      </div>
                      {notasLoading ? (
                        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /><p className="text-xs" style={{ color: '#64748B' }}>Cargando notas...</p></div>
                      ) : notasDisplay.length === 0 ? (
                        <div className="text-center py-8"><FileText size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} /><p className="text-xs font-medium" style={{ color: '#475569' }}>{filterFecha ? `Sin notas para ${formatDateDisplay(filterFecha)}` : 'Sin notas registradas'}</p><p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Click en un día del calendario para añadir</p></div>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {notasDisplay.map((n) => (
                            <div key={n.id} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{formatDateDisplay(n.fecha)}</span>
                                <span className="text-xs" style={{ color: '#94A3B8' }}>{new Date(n.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-xs font-semibold mb-1" style={{ color: '#0369A1' }}>Autor: {n.autor_nombre}</p>
                              <p className="text-sm" style={{ color: '#1E293B' }}>{n.contenido}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-pestaña: Documentos */}
                {detailTab === 'documentos' && (
                  <CrmDocumentosModule
                    usuarioServicioId={selectedUsuario.id}
                    usuarioNombre={selectedUserLabel}
                    isAdmin={isAdmin}
                  />
                )}
              </>
            )}

            {/* Modal formulario de residente */}
            {showUsuarioForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingId ? 'Editar residente' : 'Nuevo residente'}</h3>
                    <button onClick={() => setShowUsuarioForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre *</label><input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                      <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Apellidos</label><input type="text" value={formApellidos} onChange={(e) => setFormApellidos(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                    </div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Email</label><input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Teléfono</label><input type="text" value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                    <div><label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>Centros asignados</label>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {centros.map((c) => { const sel = formCentros.includes(c.id); return (
                          <button key={c.id} onClick={() => setFormCentros((prev) => sel ? prev.filter((id) => id !== c.id) : [...prev, c.id])}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                            style={{ backgroundColor: sel ? '#0369A1' : '#F1F5F9', color: sel ? '#FFFFFF' : '#475569', border: `1px solid ${sel ? '#0369A1' : '#E2E8F0'}` }}>{c.nombre}</button>
                        ); })}
                      </div>
                    </div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Observaciones</label><textarea value={formObservaciones} onChange={(e) => setFormObservaciones(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                    {formError && <p className="text-xs" style={{ color: '#DC2626' }}>{formError}</p>}
                    <div className="flex gap-2">
                      <button onClick={handleSaveUsuario} disabled={formSaving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{formSaving ? 'Guardando...' : 'Guardar'}</button>
                      <button onClick={() => setShowUsuarioForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de nota */}
            {showNotaModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div><h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva nota diaria</h3><p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{selectedUserLabel} — {formatDateDisplay(notaFecha)}</p></div>
                    <button onClick={() => setShowNotaModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
                  </div>
                  <div className="space-y-4">
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre de usuario (autor) *</label><input type="text" value={notaAutor} onChange={(e) => setNotaAutor(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nota *</label><textarea value={notaContenido} onChange={(e) => setNotaContenido(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} placeholder="Escribe el contenido de la nota..." /></div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}><AlertCircle size={12} style={{ color: '#D97706' }} /><p className="text-xs" style={{ color: '#92400E' }}>Una vez guardada, la nota no podrá ser editada ni eliminada.</p></div>
                    {notaError && <p className="text-xs" style={{ color: '#DC2626' }}>{notaError}</p>}
                    <div className="flex gap-2">
                      <button onClick={handleSaveNota} disabled={notaSaving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{notaSaving ? 'Guardando...' : 'Guardar nota'}</button>
                      <button onClick={() => setShowNotaModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === Tab: Incidencias === */}
        {activeTab === 'incidencias' && (
          <CrmIncidenciasModule isAdmin={isAdmin} centros={centros} />
        )}

        {/* === Tab: Ayuda === */}
        {activeTab === 'ayuda' && <HelpPanel currentProfileName="CRM" accentColor="#0369A1" />}
      </div>
    </div>
  );
}
