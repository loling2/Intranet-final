import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Users, Calendar, Plus, X, Search, Building2, ChevronLeft, ChevronRight,
  LogOut, KeyRound, Clock, AlertCircle, User, Phone, Mail, FileText, Trash2,
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import SocietySwitcher from '../SocietySwitcher';
import ProfileSwitcher, { type ProfileOption } from './ProfileSwitcher';
import HelpPanel from './HelpPanel';

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

interface CentroOption {
  id: string;
  nombre: string;
}

type CrmTab = 'usuarios' | 'calendario' | 'ayuda';

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
  const [activeTab, setActiveTab] = useState<CrmTab>('usuarios');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentUserNombre, setCurrentUserNombre] = useState('');

  // Usuarios de servicio
  const [usuarios, setUsuarios] = useState<UsuarioServicio[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsuario, setSelectedUsuario] = useState<UsuarioServicio | null>(null);
  const [showUsuarioForm, setShowUsuarioForm] = useState(false);
  const [centros, setCentros] = useState<CentroOption[]>([]);

  // Calendario
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [notas, setNotas] = useState<CrmNota[]>([]);
  const [notasLoading, setNotasLoading] = useState(false);
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [notaFecha, setNotaFecha] = useState<string>('');
  const [notaAutor, setNotaAutor] = useState('');
  const [notaContenido, setNotaContenido] = useState('');
  const [notaSaving, setNotaSaving] = useState(false);
  const [notaError, setNotaError] = useState('');
  const [filterFecha, setFilterFecha] = useState<string>('');

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
        supabase.from('user_profiles').select('nombre').eq('id', uid).maybeSingle()
          .then(({ data }) => {
            const nombre = data?.nombre ?? email;
            setCurrentUserNombre(nombre);
            setNotaAutor(nombre);
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
    const { data, error } = await supabase
      .from('usuarios_servicios')
      .select('id, nombre, apellidos, email, telefono, observaciones, activo')
      .order('nombre');

    if (error) {
      console.error('Error loading usuarios_servicios:', error);
      setUsuarios([]);
      setUsuariosLoading(false);
      return;
    }

    const usuariosData = data ?? [];
    const userIds = usuariosData.map((u: { id: string }) => u.id);

    let centrosMap: Record<string, { id: string; nombre: string }[]> = {};
    if (userIds.length > 0) {
      const { data: asignaciones } = await supabase
        .from('usuarios_servicios_centros')
        .select('usuario_servicio_id, centro_id, centros(id, nombre)')
        .in('usuario_servicio_id', userIds);

      for (const row of asignaciones ?? []) {
        const uid = row.usuario_servicio_id as string;
        const centro = row.centros as { id: string; nombre: string } | null;
        if (!centro) continue;
        if (!centrosMap[uid]) centrosMap[uid] = [];
        centrosMap[uid].push({ id: centro.id, nombre: centro.nombre });
      }
    }

    const usuariosWithCentros: UsuarioServicio[] = usuariosData.map((u: Record<string, unknown>) => ({
      id: u.id as string,
      nombre: u.nombre as string,
      apellidos: (u.apellidos as string) ?? null,
      email: (u.email as string) ?? null,
      telefono: (u.telefono as string) ?? null,
      observaciones: (u.observaciones as string) ?? null,
      activo: (u.activo as boolean) ?? true,
      centros: centrosMap[u.id as string] ?? [],
    }));

    setUsuarios(usuariosWithCentros);
    setUsuariosLoading(false);
  }, []);

  useEffect(() => {
    loadCentros();
    loadUsuarios();
  }, [loadCentros, loadUsuarios]);

  // Cargar notas del usuario seleccionado
  useEffect(() => {
    if (!selectedUsuario) {
      setNotas([]);
      return;
    }
    setNotasLoading(true);
    supabase
      .from('crm_notas')
      .select('id, usuario_servicio_id, fecha, autor_nombre, contenido, created_at')
      .eq('usuario_servicio_id', selectedUsuario.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading notas:', error);
          setNotas([]);
        } else {
          setNotas((data ?? []) as CrmNota[]);
        }
        setNotasLoading(false);
      });
  }, [selectedUsuario]);

  // === Usuario form ===
  const openNewUsuario = () => {
    setEditingId(null);
    setFormNombre('');
    setFormApellidos('');
    setFormEmail('');
    setFormTelefono('');
    setFormObservaciones('');
    setFormCentros([]);
    setFormError('');
    setShowUsuarioForm(true);
  };

  const openEditUsuario = (u: UsuarioServicio) => {
    setEditingId(u.id);
    setFormNombre(u.nombre);
    setFormApellidos(u.apellidos ?? '');
    setFormEmail(u.email ?? '');
    setFormTelefono(u.telefono ?? '');
    setFormObservaciones(u.observaciones ?? '');
    setFormCentros(u.centros?.map((c) => c.id) ?? []);
    setFormError('');
    setShowUsuarioForm(true);
  };

  const handleSaveUsuario = async () => {
    if (!formNombre.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }
    setFormSaving(true);
    setFormError('');

    try {
      if (editingId) {
        const { error } = await supabase
          .from('usuarios_servicios')
          .update({
            nombre: formNombre.trim(),
            apellidos: formApellidos.trim(),
            email: formEmail.trim(),
            telefono: formTelefono.trim(),
            observaciones: formObservaciones.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
        if (error) throw error;

        await supabase.from('usuarios_servicios_centros').delete().eq('usuario_servicio_id', editingId);
        if (formCentros.length > 0) {
          const rows = formCentros.map((centroId) => ({ usuario_servicio_id: editingId, centro_id: centroId }));
          await supabase.from('usuarios_servicios_centros').insert(rows);
        }
      } else {
        const { data, error } = await supabase
          .from('usuarios_servicios')
          .insert({
            nombre: formNombre.trim(),
            apellidos: formApellidos.trim(),
            email: formEmail.trim(),
            telefono: formTelefono.trim(),
            observaciones: formObservaciones.trim(),
          })
          .select('id')
          .single();
        if (error) throw error;

        const newId = data.id;
        if (formCentros.length > 0) {
          const rows = formCentros.map((centroId) => ({ usuario_servicio_id: newId, centro_id: centroId }));
          await supabase.from('usuarios_servicios_centros').insert(rows);
        }
      }

      setShowUsuarioForm(false);
      await loadUsuarios();
    } catch (err) {
      console.error('Save usuario error:', err);
      setFormError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteUsuario = async (id: string) => {
    if (!confirm('¿Eliminar este usuario de servicio? Se borrarán también sus notas.')) return;
    await supabase.from('usuarios_servicios').delete().eq('id', id);
    if (selectedUsuario?.id === id) setSelectedUsuario(null);
    await loadUsuarios();
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
  for (const n of notas) {
    notasByDate[n.fecha] = (notasByDate[n.fecha] ?? 0) + 1;
  }

  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const goToday = () => setCalendarDate(new Date());

  const openNotaModal = (fechaISO: string) => {
    setNotaFecha(fechaISO);
    setNotaContenido('');
    setNotaError('');
    setShowNotaModal(true);
  };

  const handleSaveNota = async () => {
    if (!selectedUsuario) return;
    if (!notaAutor.trim()) {
      setNotaError('El nombre del autor es obligatorio');
      return;
    }
    if (!notaContenido.trim()) {
      setNotaError('El contenido de la nota es obligatorio');
      return;
    }
    setNotaSaving(true);
    setNotaError('');

    try {
      const { data, error } = await supabase
        .from('crm_notas')
        .insert({
          usuario_servicio_id: selectedUsuario.id,
          fecha: notaFecha,
          autor_nombre: notaAutor.trim(),
          contenido: notaContenido.trim(),
        })
        .select('id, usuario_servicio_id, fecha, autor_nombre, contenido, created_at')
        .single();

      if (error) throw error;

      setNotas((prev) => [data as CrmNota, ...prev]);
      setShowNotaModal(false);
      setNotaContenido('');
    } catch (err) {
      console.error('Save nota error:', err);
      setNotaError('No se pudo guardar la nota. Inténtalo de nuevo.');
    } finally {
      setNotaSaving(false);
    }
  };

  // Notas filtradas por fecha seleccionada (si filterFecha activo)
  const notasDisplay = filterFecha
    ? notas.filter((n) => n.fecha === filterFecha)
    : notas;

  const filteredUsuarios = usuarios.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(q) ||
      (u.apellidos ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {availableProfiles && onNavigateProfile ? (
              <ProfileSwitcher
                currentLabel="CRM"
                options={availableProfiles}
                onNavigate={onNavigateProfile}
                headerText="#E0F2FE"
              />
            ) : (
              <button
                onClick={onNavigateEmployee ?? onLogout}
                title="Volver"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#E0F2FE' }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <Users size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm sm:text-lg tracking-tight">Panel CRM</h1>
              <p className="text-white/50 text-xs hidden sm:block">Gestión de usuarios de servicio y notas diarias</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <SocietySwitcher textColor="#E0F2FE" bgColor="rgba(255,255,255,0.08)" borderColor="rgba(255,255,255,0.1)" />
            {onNavigateEmployee && (
              <button
                onClick={onNavigateEmployee}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <Users size={12} />
                <span>Mi perfil empleado</span>
              </button>
            )}
            <div className="text-right hidden lg:block">
              <p className="text-white text-xs font-medium truncate max-w-[140px]">{email}</p>
              <p className="text-white/50 text-xs">CRM</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#E0F2FE', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <KeyRound size={13} />
              <span className="hidden lg:inline">Cambiar Contraseña</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Tabs */}
        <div className="md:hidden mb-6">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as CrmTab)}
              className="flex-1 bg-transparent text-sm font-medium outline-none cursor-pointer"
              style={{ color: '#0F172A' }}
            >
              <option value="usuarios">Usuarios de Servicio</option>
              <option value="calendario">Calendario y Notas</option>
              <option value="ayuda">Ayuda</option>
            </select>
          </div>
        </div>

        <div className="hidden md:flex flex-wrap gap-1 p-1 rounded-xl mb-6 sm:mb-8" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {([
            { id: 'usuarios', label: 'Usuarios de Servicio', icon: Users },
            { id: 'calendario', label: 'Calendario y Notas', icon: Calendar },
            { id: 'ayuda', label: 'Ayuda', icon: AlertCircle },
          ] as const).map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap flex-shrink-0"
                style={{ backgroundColor: isActive ? '#0369A1' : 'transparent', color: isActive ? '#FFFFFF' : '#64748B' }}
              >
                <TabIcon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* === Tab: Usuarios === */}
        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Usuarios de Servicio</h2>
                <p className="text-sm" style={{ color: '#64748B' }}>Gestiona los clientes/usuarios asignados a centros</p>
              </div>
              <button
                onClick={openNewUsuario}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
              >
                <Plus size={14} />
                Nuevo usuario
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <Search size={16} style={{ color: '#64748B' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, apellidos o email..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#0F172A' }}
              />
            </div>

            {/* Usuarios list */}
            {usuariosLoading ? (
              <div className="text-center py-12">
                <Clock size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} />
                <p className="text-sm" style={{ color: '#64748B' }}>Cargando usuarios...</p>
              </div>
            ) : filteredUsuarios.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
                <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay usuarios de servicio</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Crea el primer usuario con el botón "Nuevo usuario"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsuarios.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl p-5 transition-all duration-200 hover:shadow-md"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                          <User size={18} style={{ color: '#0369A1' }} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                            {u.nombre} {u.apellidos}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: u.activo ? '#F0FDF4' : '#FEF2F2', color: u.activo ? '#16A34A' : '#DC2626' }}>
                              {u.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      {u.email && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                          <Mail size={12} />
                          <span className="truncate">{u.email}</span>
                        </div>
                      )}
                      {u.telefono && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
                          <Phone size={12} />
                          <span>{u.telefono}</span>
                        </div>
                      )}
                    </div>

                    {u.centros && u.centros.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {u.centros.map((c) => (
                          <span key={c.id} className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                            <Building2 size={10} className="inline mr-1" />
                            {c.nombre}
                          </span>
                        ))}
                      </div>
                    )}

                    {u.observaciones && (
                      <p className="text-xs mb-3 line-clamp-2" style={{ color: '#94A3B8' }}>{u.observaciones}</p>
                    )}

                    <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                      <button
                        onClick={() => { setSelectedUsuario(u); setActiveTab('calendario'); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                        style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}
                      >
                        <Calendar size={12} />
                        Ver calendario
                      </button>
                      <button
                        onClick={() => openEditUsuario(u)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                        style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteUsuario(u.id)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ml-auto"
                        style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Usuario Form Modal */}
            {showUsuarioForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>
                      {editingId ? 'Editar usuario' : 'Nuevo usuario de servicio'}
                    </h3>
                    <button onClick={() => setShowUsuarioForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}>
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre *</label>
                        <input
                          type="text"
                          value={formNombre}
                          onChange={(e) => setFormNombre(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Apellidos</label>
                        <input
                          type="text"
                          value={formApellidos}
                          onChange={(e) => setFormApellidos(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Email</label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Teléfono</label>
                      <input
                        type="text"
                        value={formTelefono}
                        onChange={(e) => setFormTelefono(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>Centros asignados</label>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {centros.map((c) => {
                          const selected = formCentros.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => {
                                setFormCentros((prev) => selected ? prev.filter((id) => id !== c.id) : [...prev, c.id]);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                              style={{
                                backgroundColor: selected ? '#0369A1' : '#F1F5F9',
                                color: selected ? '#FFFFFF' : '#475569',
                                border: `1px solid ${selected ? '#0369A1' : '#E2E8F0'}`,
                              }}
                            >
                              {c.nombre}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Observaciones</label>
                      <textarea
                        value={formObservaciones}
                        onChange={(e) => setFormObservaciones(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                      />
                    </div>
                    {formError && <p className="text-xs" style={{ color: '#DC2626' }}>{formError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveUsuario}
                        disabled={formSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60"
                        style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
                      >
                        {formSaving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => setShowUsuarioForm(false)}
                        className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100"
                        style={{ color: '#64748B' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === Tab: Calendario === */}
        {activeTab === 'calendario' && (
          <div className="space-y-6">
            {/* Selector de usuario */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>Usuario de servicio</label>
              <div className="flex flex-wrap gap-2">
                {usuarios.length === 0 ? (
                  <p className="text-sm" style={{ color: '#94A3B8' }}>Primero crea usuarios en la pestaña "Usuarios de Servicio"</p>
                ) : (
                  usuarios.map((u) => {
                    const isActive = selectedUsuario?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUsuario(u)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                        style={{
                          backgroundColor: isActive ? '#0369A1' : '#F1F5F9',
                          color: isActive ? '#FFFFFF' : '#475569',
                          border: `1px solid ${isActive ? '#0369A1' : '#E2E8F0'}`,
                        }}
                      >
                        {u.nombre} {u.apellidos}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {selectedUsuario && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Calendar */}
                  <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                        {MONTH_NAMES[month]} {year}
                      </h3>
                      <div className="flex items-center gap-1">
                        <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>
                          <ChevronLeft size={16} />
                        </button>
                        <button onClick={goToday} className="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                          Hoy
                        </button>
                        <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {DAY_NAMES.map((d) => (
                        <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: '#94A3B8' }}>{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {calendarCells.map((cell, i) => {
                        if (!cell.date || !cell.iso) {
                          return <div key={i} className="aspect-square" />;
                        }
                        const isToday = cell.iso === todayISO;
                        const notaCount = notasByDate[cell.iso] ?? 0;
                        const isFiltered = filterFecha === cell.iso;
                        return (
                          <button
                            key={i}
                            onClick={() => openNotaModal(cell.iso!)}
                            onContextMenu={(e) => { e.preventDefault(); setFilterFecha(isFiltered ? '' : cell.iso!); }}
                            className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs cursor-pointer transition-all relative"
                            style={{
                              backgroundColor: isFiltered ? '#0369A1' : isToday ? '#EFF6FF' : '#F8FAFC',
                              color: isFiltered ? '#FFFFFF' : isToday ? '#0369A1' : '#475569',
                              border: isToday ? '1px solid #BFDBFE' : '1px solid transparent',
                            }}
                            title={`${formatDateDisplay(cell.iso)} — Click para añadir nota. Clic derecho para filtrar.`}
                          >
                            <span className="font-medium">{cell.date!.getDate()}</span>
                            {notaCount > 0 && (
                              <span
                                className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: isFiltered ? '#FFFFFF' : '#0369A1' }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>
                      Click en un día para añadir nota · Clic derecho para filtrar por fecha
                    </p>
                  </div>

                  {/* Notas historial */}
                  <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FileText size={16} style={{ color: '#0369A1' }} />
                        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                          Historial de Notas
                        </h3>
                      </div>
                      {filterFecha && (
                        <button
                          onClick={() => setFilterFecha('')}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer"
                          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                        >
                          <X size={10} />
                          Quitar filtro {formatDateDisplay(filterFecha)}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}>
                      <AlertCircle size={14} style={{ color: '#D97706' }} />
                      <p className="text-xs" style={{ color: '#92400E' }}>
                        Las notas son registros históricos de solo lectura. No se pueden editar ni borrar.
                      </p>
                    </div>

                    {notasLoading ? (
                      <div className="text-center py-8">
                        <Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} />
                        <p className="text-xs" style={{ color: '#64748B' }}>Cargando notas...</p>
                      </div>
                    ) : notasDisplay.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
                        <p className="text-xs font-medium" style={{ color: '#475569' }}>
                          {filterFecha ? `Sin notas para ${formatDateDisplay(filterFecha)}` : 'Sin notas registradas'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Click en un día del calendario para añadir</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {notasDisplay.map((n) => (
                          <div
                            key={n.id}
                            className="rounded-xl p-4"
                            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                                {formatDateDisplay(n.fecha)}
                              </span>
                              <span className="text-xs" style={{ color: '#94A3B8' }}>
                                {new Date(n.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs font-semibold mb-1" style={{ color: '#0369A1' }}>
                              Autor: {n.autor_nombre}
                            </p>
                            <p className="text-sm" style={{ color: '#1E293B' }}>{n.contenido}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {!selectedUsuario && usuarios.length > 0 && (
              <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <Calendar size={40} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
                <p className="text-sm font-medium" style={{ color: '#475569' }}>Selecciona un usuario de servicio para ver su calendario</p>
              </div>
            )}

            {/* Nota Modal */}
            {showNotaModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva nota diaria</h3>
                      <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                        {selectedUsuario?.nombre} {selectedUsuario?.apellidos} — {formatDateDisplay(notaFecha)}
                      </p>
                    </div>
                    <button onClick={() => setShowNotaModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}>
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre de usuario (autor) *</label>
                      <input
                        type="text"
                        value={notaAutor}
                        onChange={(e) => setNotaAutor(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nota *</label>
                      <textarea
                        value={notaContenido}
                        onChange={(e) => setNotaContenido(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                        placeholder="Escribe el contenido de la nota..."
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}>
                      <AlertCircle size={12} style={{ color: '#D97706' }} />
                      <p className="text-xs" style={{ color: '#92400E' }}>
                        Una vez guardada, la nota no podrá ser editada ni eliminada.
                      </p>
                    </div>
                    {notaError && <p className="text-xs" style={{ color: '#DC2626' }}>{notaError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNota}
                        disabled={notaSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60"
                        style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
                      >
                        {notaSaving ? 'Guardando...' : 'Guardar nota'}
                      </button>
                      <button
                        onClick={() => setShowNotaModal(false)}
                        className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100"
                        style={{ color: '#64748B' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === Tab: Ayuda === */}
        {activeTab === 'ayuda' && (
          <HelpPanel currentProfileName="CRM" accentColor="#0369A1" />
        )}
      </div>
    </div>
  );
}
