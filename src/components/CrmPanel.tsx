import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Users, Calendar, Plus, X, Search, Building2, ChevronLeft, ChevronRight,
  LogOut, KeyRound, Clock, AlertCircle, User, Phone, Mail, FileText,
  FolderOpen, AlertTriangle, BarChart3, ClipboardList, Pill, Trash2,
  ToggleLeft, ToggleRight, ScrollText,
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import SocietySwitcher from '../SocietySwitcher';
import ProfileSwitcher, { type ProfileOption } from './ProfileSwitcher';
import HelpPanel from './HelpPanel';
import CrmDocumentosModule from './CrmDocumentosModule';
import CrmIncidenciasModule from './CrmIncidenciasModule';
import CrmResidenteFicha from './CrmResidenteFicha';
import CrmActividadesModule from './CrmActividadesModule';
import CrmActasModule from './CrmActasModule';
import CrmEstadisticasModule from './CrmEstadisticasModule';
import CrmTratamientosDiarioModule from './CrmTratamientosDiarioModule';
import CrmAsignacionesTabs from './CrmAsignacionesTabs';
import CrmLogsModule from './CrmLogsModule';
import { fetchCrmPestanasPermitidas } from '../lib/crmPestanas';

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
  acronimo: string | null;
  activo: boolean;
  borrado_at: string | null;
  centros?: { id: string; nombre: string }[];
}

interface CrmNota {
  id: string;
  usuario_servicio_id: string;
  fecha: string | null;
  autor_nombre: string;
  contenido: string;
  created_at: string;
}

interface CentroOption { id: string; nombre: string; }

type CrmTab = 'residentes' | 'incidencias' | 'actividades' | 'actas' | 'tratamientos' | 'estadisticas' | 'ayuda' | 'permisos' | 'logs';
type ResidentStatus = 'activos' | 'inactivos' | 'borrados';

const CRM_TABS: { id: CrmTab; label: string; icon: typeof Users }[] = [
  { id: 'residentes', label: 'Residentes', icon: Users },
  { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle },
  { id: 'actividades', label: 'Actividades', icon: Calendar },
  { id: 'actas', label: 'Actas', icon: ClipboardList },
  { id: 'tratamientos', label: 'Tratamientos', icon: Pill },
  { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { id: 'ayuda', label: 'Ayuda', icon: AlertCircle },
  { id: 'permisos', label: 'Permisos', icon: KeyRound },
  { id: 'logs', label: 'Logs', icon: ScrollText },
];

function tabVisible(id: CrmTab, permitidas: string[], gestor: boolean, admin: boolean): boolean {
  if (id === 'logs') return admin;
  return permitidas.includes(id) || (id === 'permisos' && gestor);
}

const RESIDENT_MANAGER_ROLES = [
  'admin', 'rrhh', 'prevencion', 'supervisor', 'coordinador',
  'rrhh_gerontalia', 'administrador_gerontalia',
  'supervisor_gerontalia', 'prevencion_gerontalia',
];

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
  const [isGestor, setIsGestor] = useState(false);
  const [canManageResidents, setCanManageResidents] = useState(false);
  const [pestanasPermitidas, setPestanasPermitidas] = useState<string[] | null>(null);

  // Usuarios
  const [usuarios, setUsuarios] = useState<UsuarioServicio[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCentro, setFilterCentro] = useState<string>('');
  const [residentStatus, setResidentStatus] = useState<ResidentStatus>('activos');
  const [selectedUsuario, setSelectedUsuario] = useState<UsuarioServicio | null>(null);
  const [showUsuarioForm, setShowUsuarioForm] = useState(false);
  const [centros, setCentros] = useState<CentroOption[]>([]);
  const [showQuickNotaPicker, setShowQuickNotaPicker] = useState(false);
  const [quickNotaSearch, setQuickNotaSearch] = useState('');
  const [fichaInitialTab, setFichaInitialTab] = useState<'info' | 'calendario'>('info');
  const [residentActionId, setResidentActionId] = useState<string | null>(null);
  const [residentActionError, setResidentActionError] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<UsuarioServicio | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDeletePin, setShowDeletePin] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);

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
  const [editingNotaId, setEditingNotaId] = useState<string | null>(null);
  const [onDeleteNota, setOnDeleteNota] = useState<((id: string) => void) | null>(null);
  const [filterFecha, setFilterFecha] = useState('');


  // Usuario form
  const [formNombre, setFormNombre] = useState('');
  const [formApellidos, setFormApellidos] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  const [formAcronimo, setFormAcronimo] = useState('');
  const [formCentros, setFormCentros] = useState<string[]>([]);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      if (uid) {
        supabase.from('user_profiles').select('nombre, role, roles').eq('id', uid).maybeSingle()
          .then(({ data }) => {
            const profileData = data as { nombre?: string; role?: string; roles?: string[] } | null;
            const roles = new Set([profileData?.role, ...(profileData?.roles ?? [])].filter((role): role is string => Boolean(role)));
            const nombre = profileData?.nombre ?? email;
            setCurrentUserNombre(nombre);
            setNotaAutor(nombre);
            setIsAdmin(roles.has('admin'));
            setCanManageResidents(RESIDENT_MANAGER_ROLES.some((role) => roles.has(role)));
            fetchCrmPestanasPermitidas(uid).then(setPestanasPermitidas);
            supabase.rpc('crm_es_gestor').then(({ data: gestor }) => setIsGestor(gestor === true));
          });
      }
    });
  }, [email]);

  useEffect(() => {
    if (!pestanasPermitidas) return;
    if (tabVisible(activeTab, pestanasPermitidas, isGestor, isAdmin)) return;
    const primera = CRM_TABS.find((t) => tabVisible(t.id, pestanasPermitidas, isGestor, isAdmin));
    if (primera) setActiveTab(primera.id);
  }, [pestanasPermitidas, isGestor, activeTab]);

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
    const { data: residentExtras } = userIds.length > 0
      ? await supabase.from('usuarios_servicios').select('id, acronimo, borrado_at').in('id', userIds)
      : { data: [] as { id: string; acronimo: string | null; borrado_at: string | null }[] };
    const extras = Object.fromEntries(((residentExtras ?? []) as { id: string; acronimo: string | null; borrado_at: string | null }[]).map((u) => [u.id, u]));
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
      acronimo: extras[u.id]?.acronimo ?? '', activo: u.activo, borrado_at: extras[u.id]?.borrado_at ?? null, centros: centrosMap[u.id] ?? [],
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
    setFormTelefono(''); setFormObservaciones(''); setFormAcronimo(''); setFormCentros([]); setFormError('');
    setShowUsuarioForm(true);
  };
  const openEditUsuario = (u: UsuarioServicio) => {
    setEditingId(u.id); setFormNombre(u.nombre); setFormApellidos(u.apellidos ?? '');
    setFormEmail(u.email ?? ''); setFormTelefono(u.telefono ?? '');
    setFormObservaciones(u.observaciones ?? ''); setFormAcronimo(u.acronimo ?? '');
    setFormCentros(u.centros?.map((c) => c.id) ?? []); setFormError('');
    setShowUsuarioForm(true);
  };
  const handleSaveUsuario = async () => {
    if (!formNombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    if (!editingId && formCentros.length === 0) { setFormError('Selecciona al menos un centro'); return; }
    setFormSaving(true); setFormError('');
    try {
      if (editingId) {
        const { error } = await supabase.from('usuarios_servicios').update({
          nombre: formNombre.trim(), apellidos: formApellidos.trim(), email: formEmail.trim(),
          telefono: formTelefono.trim(), observaciones: formObservaciones.trim(), acronimo: formAcronimo.trim(), updated_at: new Date().toISOString(),
        }).eq('id', editingId);
        if (error) throw error;
        const { error: deleteCentrosError } = await supabase.from('usuarios_servicios_centros').delete().eq('usuario_servicio_id', editingId);
        if (deleteCentrosError) throw deleteCentrosError;
        if (formCentros.length > 0) {
          const { error: insertCentrosError } = await supabase.from('usuarios_servicios_centros').insert(
            formCentros.map((c) => ({ usuario_servicio_id: editingId, centro_id: c })),
          );
          if (insertCentrosError) throw insertCentrosError;
        }
      } else {
        const { error } = await supabase.rpc('create_crm_residente', {
          p_nombre: formNombre.trim(),
          p_apellidos: formApellidos.trim(),
          p_email: formEmail.trim(),
          p_telefono: formTelefono.trim(),
          p_observaciones: formObservaciones.trim(),
          p_acronimo: formAcronimo.trim(),
          p_centro_ids: formCentros,
        });
        if (error) throw error;
      }
      setShowUsuarioForm(false); await loadUsuarios();
    } catch (error) {
      console.error('CRM resident save failed', error);
      setFormError('No se pudo guardar. Inténtalo de nuevo.');
    }
    finally { setFormSaving(false); }
  };
  // === Calendario ===
  const handleToggleActivo = async (usuario: UsuarioServicio) => {
    if (!canManageResidents || usuario.borrado_at || residentActionId) return;
    setResidentActionId(usuario.id);
    setResidentActionError('');
    const { error } = await supabase.rpc('crm_toggle_residente_activo', {
      p_residente_id: usuario.id,
      p_activo: !usuario.activo,
    });
    if (error) {
      console.error('CRM resident status change failed', error);
      setResidentActionError('No se pudo cambiar el estado del residente.');
    } else {
      await loadUsuarios();
      setSelectedUsuario((current) => current?.id === usuario.id ? { ...current, activo: !usuario.activo } : current);
    }
    setResidentActionId(null);
  };

  const requestDelete = (usuario: UsuarioServicio) => {
    if (!canManageResidents || usuario.borrado_at) return;
    setDeleteCandidate(usuario);
    setDeleteError('');
    setShowDeleteConfirmation(true);
  };

  const openDeletePin = () => {
    setShowDeleteConfirmation(false);
    setDeletePin('');
    setDeleteError('');
    setShowDeletePin(true);
  };

  const getDeleteError = (message: string): string => {
    if (message.includes('PIN_REQUIRED')) return 'Introduce tu PIN para continuar.';
    if (message.includes('PIN_INVALID')) return 'El PIN no es válido para tu usuario.';
    if (message.includes('NOT_AUTHORIZED')) return 'No tienes permiso para realizar esta acción.';
    if (message.includes('RESIDENT_ALREADY_DELETED')) return 'Este residente ya está en la papelera.';
    if (message.includes('RESIDENT_NOT_VISIBLE')) return 'No puedes gestionar este residente.';
    return 'No se pudo borrar el residente.';
  };

  const handleDeleteResident = async () => {
    if (!deleteCandidate || !deletePin.trim()) {
      setDeleteError('Introduce tu PIN para continuar.');
      return;
    }
    setDeleteSaving(true);
    setDeleteError('');
    const { error } = await supabase.rpc('crm_borrar_residente', {
      p_residente_id: deleteCandidate.id,
      p_pin: deletePin.trim(),
    });
    if (error) {
      console.error('CRM resident deletion failed', error);
      setDeleteError(getDeleteError(error.message ?? ''));
    } else {
      setShowDeletePin(false);
      setDeleteCandidate(null);
      setDeletePin('');
      setSelectedUsuario((current) => current?.id === deleteCandidate.id ? null : current);
      await loadUsuarios();
    }
    setDeleteSaving(false);
  };

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
  for (const n of notas) { if (n.fecha) notasByDate[n.fecha] = (notasByDate[n.fecha] ?? 0) + 1; }
  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const goToday = () => setCalendarDate(new Date());
  const openNotaModal = (fechaISO: string) => { setNotaFecha(fechaISO); setNotaContenido(''); setNotaError(''); setEditingNotaId(null); setShowNotaModal(true); };
  const openQuickNotaPicker = () => { setQuickNotaSearch(''); setShowQuickNotaPicker(true); };
  const openEditNotaModal = (nota: { id: string; fecha: string | null; autor_nombre: string; contenido: string }) => {
    setEditingNotaId(nota.id); setNotaFecha(nota.fecha); setNotaAutor(nota.autor_nombre); setNotaContenido(nota.contenido); setNotaError(''); setShowNotaModal(true);
  };
  const handleDeleteNota = async (notaId: string) => {
    if (!selectedUsuario) return;
    try { await supabase.from('crm_notas').delete().eq('id', notaId); setNotas((prev) => prev.filter((n) => n.id !== notaId)); }
    catch { /* non-fatal */ }
  };
  const handleSaveNota = async () => {
    if (!selectedUsuario) return;
    if (!notaAutor.trim()) { setNotaError('El nombre del autor es obligatorio'); return; }
    if (!notaContenido.trim()) { setNotaError('El contenido de la nota es obligatorio'); return; }
    setNotaSaving(true); setNotaError('');
    try {
      if (editingNotaId) {
        const { data, error } = await supabase.from('crm_notas').update({
          fecha: notaFecha || null, autor_nombre: notaAutor.trim(), contenido: notaContenido.trim(),
        }).eq('id', editingNotaId).select('id, usuario_servicio_id, fecha, autor_nombre, contenido, created_at').single();
        if (error) throw error;
        setNotas((prev) => prev.map((n) => n.id === editingNotaId ? data as CrmNota : n));
      } else {
        const { data, error } = await supabase.from('crm_notas').insert({
          usuario_servicio_id: selectedUsuario.id, fecha: notaFecha || null,
          autor_nombre: notaAutor.trim(), contenido: notaContenido.trim(),
        }).select('id, usuario_servicio_id, fecha, autor_nombre, contenido, created_at').single();
        if (error) throw error;
        const mentionRows = Array.from(notaContenido.matchAll(/@([^\s@]+)/g)).flatMap((match) => {
          const token = match[1].toLowerCase();
          const resident = usuarios.find((u) => [u.nombre, u.acronimo ?? '', `${u.nombre} ${u.apellidos ?? ''}`].some((value) => value.toLowerCase() === token));
          return resident ? [{ nota_id: (data as CrmNota).id, mencionado_usuario_servicio_id: resident.id, texto_mencion: match[1] }] : [];
        });
        if (mentionRows.length > 0) {
          const { error: mentionError } = await supabase.from('crm_nota_menciones').insert(mentionRows);
          if (mentionError) throw mentionError;
        }
        setNotas((prev) => [data as CrmNota, ...prev]);
      }
      setShowNotaModal(false); setNotaContenido(''); setEditingNotaId(null);
    } catch { setNotaError('No se pudo guardar la nota.'); }
    finally { setNotaSaving(false); }
  };
  const notasDisplay = filterFecha ? notas.filter((n) => n.fecha === filterFecha) : notas;

  const filteredUsuarios = usuarios.filter((u) => {
    if (residentStatus === 'borrados' ? !u.borrado_at : u.borrado_at || (residentStatus === 'activos' ? !u.activo : u.activo)) return false;
    if (filterCentro && !(u.centros ?? []).some((c) => c.id === filterCentro)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().replace(/^@+/, '').toLowerCase();
    return u.nombre.toLowerCase().includes(q) || (u.apellidos ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q) || (u.acronimo ?? '').toLowerCase().includes(q);
  });

  // Usuario seleccionado display
  const selectedUserLabel = selectedUsuario ? `${selectedUsuario.nombre} ${selectedUsuario.apellidos ?? ''}` : '';
  const mentionMatch = notaContenido.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1].toLowerCase() ?? '';
  const mentionCandidates = mentionMatch
    ? usuarios.filter((u) => `${u.nombre} ${u.apellidos ?? ''} ${u.acronimo ?? ''}`.toLowerCase().includes(mentionQuery)).slice(0, 6)
    : [];
  const handleNotaContenidoChange = (value: string) => setNotaContenido(value);
  const insertMention = (u: UsuarioServicio) => {
    const mention = `@${u.acronimo || u.nombre}`;
    setNotaContenido(notaContenido.replace(/(?:^|\s)@[^\s@]*$/, (match) => `${match.startsWith(' ') ? ' ' : ''}${mention} `));
  };

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
              {CRM_TABS.filter((t) => tabVisible(t.id, pestanasPermitidas ?? [], isGestor, isAdmin)).map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="hidden md:flex flex-wrap gap-1 p-1 rounded-xl mb-6 sm:mb-8" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {CRM_TABS.filter((t) => tabVisible(t.id, pestanasPermitidas ?? [], isGestor, isAdmin)).map((tab) => {
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
                  <div className="flex items-center gap-2">
                    <button onClick={openQuickNotaPicker}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                      style={{ backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>
                      <FileText size={14} />Añadir nota
                    </button>
                    {(isAdmin || isGestor) && (
                      <button onClick={openNewUsuario}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                        style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                        <Plus size={14} />Nuevo residente
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ backgroundColor: '#E2E8F0' }}>
                    {([
                      { id: 'activos' as ResidentStatus, label: 'Activos' },
                      { id: 'inactivos' as ResidentStatus, label: 'Inactivos' },
                      { id: 'borrados' as ResidentStatus, label: 'Borrados' },
                    ]).map((status) => (
                      <button key={status.id} onClick={() => { setResidentStatus(status.id); setSelectedUsuario(null); }}
                        className="px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-all"
                        style={{ backgroundColor: residentStatus === status.id ? '#FFFFFF' : 'transparent', color: residentStatus === status.id ? '#0369A1' : '#64748B', boxShadow: residentStatus === status.id ? '0 1px 2px rgba(15,23,42,0.08)' : 'none' }}>
                        {status.label}
                      </button>
                    ))}
                  </div>
                  {residentActionError && <p className="text-xs font-medium" style={{ color: '#B91C1C' }}>{residentActionError}</p>}
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
                        onClick={() => { setSelectedUsuario(u); setFichaInitialTab('info'); }}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: u.borrado_at ? '#FEF2F2' : '#EFF6FF' }}>
                              <User size={22} style={{ color: u.borrado_at ? '#DC2626' : '#0369A1' }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{u.nombre} {u.apellidos}</p>
                              <p className="text-xs font-medium" style={{ color: u.acronimo ? '#0369A1' : '#94A3B8' }}>{u.acronimo ? `@${u.acronimo}` : 'Sin acrónimo'}</p>
                              <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: u.borrado_at ? '#FEF2F2' : u.activo ? '#F0FDF4' : '#FFF7ED', color: u.borrado_at ? '#DC2626' : u.activo ? '#16A34A' : '#C2410C' }}>{u.borrado_at ? 'Borrado' : u.activo ? 'Activo' : 'Inactivo'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {canManageResidents && !u.borrado_at && (
                              <>
                                <button type="button" title={u.activo ? 'Marcar como inactivo' : 'Marcar como activo'} aria-label={u.activo ? 'Marcar como inactivo' : 'Marcar como activo'} disabled={residentActionId === u.id}
                                  onClick={(event) => { event.stopPropagation(); handleToggleActivo(u); }} className="p-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 hover:bg-slate-100">
                                  {u.activo ? <ToggleRight size={20} style={{ color: '#16A34A' }} /> : <ToggleLeft size={20} style={{ color: '#C2410C' }} />}
                                </button>
                                <button type="button" title="Enviar a borrados" aria-label="Enviar residente a borrados"
                                  onClick={(event) => { event.stopPropagation(); requestDelete(u); }} className="p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-red-50">
                                  <Trash2 size={16} style={{ color: '#DC2626' }} />
                                </button>
                              </>
                            )}
                            <ChevronRight size={16} style={{ color: '#CBD5E1' }} />
                          </div>
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
              <div className="space-y-6">
                <button onClick={() => setSelectedUsuario(null)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                  style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                  <ChevronLeft size={14} /> Volver
                </button>
              <CrmResidenteFicha
                key={selectedUsuario.id + (fichaInitialTab === 'calendario' ? '-cal' : '')}
                usuario={selectedUsuario}
                initialTab={fichaInitialTab}
                pestanasPermitidas={pestanasPermitidas ?? []}
                isAdmin={isAdmin}
                isGestor={isGestor}
                notas={notas}
                notasLoading={notasLoading}
                calendarCells={calendarCells}
                notasByDate={notasByDate}
                todayISO={todayISO}
                month={month}
                year={year}
                filterFecha={filterFecha}
                setFilterFecha={setFilterFecha}
                prevMonth={prevMonth}
                nextMonth={nextMonth}
                goToday={goToday}
                openNotaModal={openNotaModal}
                openEditNotaModal={openEditNotaModal}
                onDeleteNota={handleDeleteNota}
                notasDisplay={notasDisplay}
                MONTH_NAMES={MONTH_NAMES}
                DAY_NAMES={DAY_NAMES}
                formatDateDisplay={formatDateDisplay}
                onEdit={() => openEditUsuario(selectedUsuario)}
                autorNombre={currentUserNombre}
                canManageResident={canManageResidents}
                onToggleActivo={() => handleToggleActivo(selectedUsuario)}
                onDelete={() => requestDelete(selectedUsuario)}
              />
              </div>
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
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Acrónimo</label><input type="text" value={formAcronimo} onChange={(e) => setFormAcronimo(e.target.value)} maxLength={30} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} placeholder="Identificador corto" /></div>
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

            {showDeleteConfirmation && deleteCandidate && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.48)', backdropFilter: 'blur(3px)' }}>
                <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF2F2' }}><Trash2 size={18} style={{ color: '#DC2626' }} /></div>
                    <div><h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Borrar residente</h3><p className="text-sm mt-1" style={{ color: '#475569' }}>¿Quieres enviar a <strong>{deleteCandidate.nombre} {deleteCandidate.apellidos ?? ''}</strong> a la pestaña Borrados?</p><p className="text-xs mt-2" style={{ color: '#94A3B8' }}>Sus notas y documentos se conservarán.</p></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <button onClick={() => { setShowDeleteConfirmation(false); setDeleteCandidate(null); }} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
                    <button onClick={openDeletePin} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}><KeyRound size={14} /> Continuar</button>
                  </div>
                </div>
              </div>
            )}

            {showDeletePin && deleteCandidate && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.48)', backdropFilter: 'blur(3px)' }}>
                <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFF7ED' }}><KeyRound size={18} style={{ color: '#C2410C' }} /></div>
                    <div><h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Confirmar con PIN</h3><p className="text-sm mt-1" style={{ color: '#475569' }}>Introduce tu PIN para borrar a {deleteCandidate.nombre}.</p></div>
                  </div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>PIN de seguridad</label>
                  <input autoFocus type="password" inputMode="numeric" maxLength={12} value={deletePin} onChange={(event) => setDeletePin(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleDeleteResident(); }} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none tracking-[0.25em]" style={{ border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', color: '#0F172A' }} />
                  {deleteError && <p className="mt-2 text-xs" style={{ color: '#DC2626' }}>{deleteError}</p>}
                  <div className="flex justify-end gap-2 mt-6">
                    <button onClick={() => { setShowDeletePin(false); setDeleteCandidate(null); setDeletePin(''); }} disabled={deleteSaving} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
                    <button onClick={handleDeleteResident} disabled={deleteSaving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}><Trash2 size={14} /> {deleteSaving ? 'Borrando...' : 'Borrar residente'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Acceso rápido a notas */}
            {showQuickNotaPicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div><h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Añadir nota</h3><p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Elige un residente para abrir su calendario</p></div>
                    <button onClick={() => setShowQuickNotaPicker(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <Search size={15} style={{ color: '#94A3B8' }} />
                    <input autoFocus type="text" value={quickNotaSearch} onChange={(e) => setQuickNotaSearch(e.target.value)} placeholder="Buscar residente..." className="flex-1 bg-transparent text-sm outline-none" style={{ color: '#0F172A' }} />
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {usuarios.filter((u) => `${u.nombre} ${u.apellidos ?? ''} ${u.acronimo ?? ''}`.toLowerCase().includes(quickNotaSearch.trim().replace(/^@+/, '').toLowerCase())).map((u) => (
                      <button key={u.id} onClick={() => { setFichaInitialTab('calendario'); setSelectedUsuario(u); setShowQuickNotaPicker(false); openNotaModal(todayISO); }} className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-left cursor-pointer hover:bg-blue-50" style={{ color: '#0F172A' }}>
                        <span className="text-left"><span className="block text-sm font-medium">{u.nombre} {u.apellidos ?? ''}</span>{u.acronimo && <span className="block text-xs mt-0.5" style={{ color: '#0369A1' }}>@{u.acronimo}</span>}</span><ChevronRight size={14} style={{ color: '#94A3B8' }} />
                      </button>
                    ))}
                    {usuarios.filter((u) => `${u.nombre} ${u.apellidos ?? ''} ${u.acronimo ?? ''}`.toLowerCase().includes(quickNotaSearch.trim().replace(/^@+/, '').toLowerCase())).length === 0 && <p className="text-center text-xs py-6" style={{ color: '#94A3B8' }}>No hay residentes que coincidan</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Modal de nota */}
            {showNotaModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div><h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingNotaId ? 'Editar nota' : 'Nueva nota diaria'}</h3><p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{selectedUserLabel}{notaFecha ? ` — ${formatDateDisplay(notaFecha)}` : ' — Sin fecha'}</p></div>
                    <button onClick={() => setShowNotaModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
                  </div>
                  <div className="space-y-4">
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Fecha (opcional)</label><input type="date" value={notaFecha} onChange={(e) => setNotaFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre de usuario (autor) *</label><input type="text" value={notaAutor} onChange={(e) => setNotaAutor(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                    <div className="relative"><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nota *</label><textarea value={notaContenido} onChange={(e) => handleNotaContenidoChange(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} placeholder="Escribe el contenido. Usa @ para mencionar un residente..." />
                      {mentionMatch && mentionCandidates.length > 0 && <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-lg p-1 shadow-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>{mentionCandidates.map((u) => <button key={u.id} type="button" onClick={() => insertMention(u)} className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left cursor-pointer hover:bg-slate-50"><span className="text-sm font-medium" style={{ color: '#0F172A' }}>{u.nombre} {u.apellidos ?? ''}</span>{u.acronimo && <span className="text-xs" style={{ color: '#0369A1' }}>{u.acronimo}</span>}</button>)}</div>}
                    </div>
                    {notaError && <p className="text-xs" style={{ color: '#DC2626' }}>{notaError}</p>}
                    <div className="flex gap-2">
                      <button onClick={handleSaveNota} disabled={notaSaving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{notaSaving ? 'Guardando...' : editingNotaId ? 'Guardar cambios' : 'Guardar nota'}</button>
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

        {/* === Tab: Actividades === */}
        {activeTab === 'actividades' && (
          <CrmActividadesModule isAdmin={isAdmin} centros={centros} />
        )}

        {/* === Tab: Actas === */}
        {activeTab === 'actas' && (
          <CrmActasModule isAdmin={isAdmin} centros={centros} />
        )}

        {/* === Tab: Tratamientos (calendario diario por turnos) === */}
        {activeTab === 'tratamientos' && <CrmTratamientosDiarioModule />}

        {/* === Tab: Estadísticas === */}
        {activeTab === 'estadisticas' && (
          <CrmEstadisticasModule centros={centros} />
        )}

        {/* === Tab: Ayuda === */}
        {activeTab === 'ayuda' && <HelpPanel currentProfileName="CRM" accentColor="#0369A1" />}

        {/* === Tab: Permisos (gestores y puestos con el permiso activo) === */}
        {activeTab === 'permisos' && (
          <CrmAsignacionesTabs />
        )}

        {activeTab === 'logs' && isAdmin && <CrmLogsModule />}
      </div>
    </div>
  );
}
