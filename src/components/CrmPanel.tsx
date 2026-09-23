import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Users, Calendar, Plus, X, Search, Building2, ChevronLeft, ChevronRight,
  LogOut, KeyRound, Clock, AlertCircle, User, Phone, Mail, FileText, Trash2,
  FolderOpen, Lock, Unlock, Eye, Shield, Download, Upload,
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

interface CrmDocumento {
  id: string;
  usuario_servicio_id: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  archivo_url: string;
  archivo_nombre: string;
  subido_por: string;
  created_at: string;
}

interface AutorizableUser {
  id: string;
  nombre: string;
  email: string;
  role: string;
}

interface CentroOption { id: string; nombre: string; }

type CrmTab = 'usuarios' | 'calendario' | 'documentos' | 'ayuda';
type DocSubTab = 'publicos' | 'privados';

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

  // Usuarios
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
  const [notaFecha, setNotaFecha] = useState('');
  const [notaAutor, setNotaAutor] = useState('');
  const [notaContenido, setNotaContenido] = useState('');
  const [notaSaving, setNotaSaving] = useState(false);
  const [notaError, setNotaError] = useState('');
  const [filterFecha, setFilterFecha] = useState('');

  // Buscador de usuarios (calendario y documentos)
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UsuarioServicio[]>([]);
  const [userSearchFocused, setUserSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  // Documentos
  const [docSubTab, setDocSubTab] = useState<DocSubTab>('publicos');
  const [documentos, setDocumentos] = useState<CrmDocumento[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docTitulo, setDocTitulo] = useState('');
  const [docDescripcion, setDocDescripcion] = useState('');
  const [docTipo, setDocTipo] = useState<'publico' | 'privado'>('publico');
  const [docArchivo, setDocArchivo] = useState<File | null>(null);
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  // Autorizaciones
  const [autorizables, setAutorizables] = useState<AutorizableUser[]>([]);
  const [docAutorizaciones, setDocAutorizaciones] = useState<Record<string, string[]>>({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authDocId, setAuthDocId] = useState<string | null>(null);

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
    if (error) { setUsuarios([]); setUsuariosLoading(false); return; }

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
      id: u.id as string, nombre: u.nombre as string,
      apellidos: (u.apellidos as string) ?? null, email: (u.email as string) ?? null,
      telefono: (u.telefono as string) ?? null, observaciones: (u.observaciones as string) ?? null,
      activo: (u.activo as boolean) ?? true, centros: centrosMap[u.id as string] ?? [],
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

  // Cargar documentos del usuario seleccionado
  useEffect(() => {
    if (!selectedUsuario) { setDocumentos([]); return; }
    setDocsLoading(true);
    supabase.from('crm_documentos')
      .select('id, usuario_servicio_id, titulo, descripcion, tipo, archivo_url, archivo_nombre, subido_por, created_at')
      .eq('usuario_servicio_id', selectedUsuario.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { setDocumentos([]); } else { setDocumentos((data ?? []) as CrmDocumento[]); }
        setDocsLoading(false);
      });
  }, [selectedUsuario]);

  // Cargar autorizaciones de documentos privados
  useEffect(() => {
    if (!selectedUsuario || documentos.length === 0) { setDocAutorizaciones({}); return; }
    const privDocIds = documentos.filter((d) => d.tipo === 'privado').map((d) => d.id);
    if (privDocIds.length === 0) { setDocAutorizaciones({}); return; }
    supabase.from('crm_documentos_autorizaciones')
      .select('documento_id, user_id')
      .in('documento_id', privDocIds)
      .then(({ data }) => {
        const map: Record<string, string[]> = {};
        for (const row of (data ?? []) as { documento_id: string; user_id: string }[]) {
          if (!map[row.documento_id]) map[row.documento_id] = [];
          map[row.documento_id].push(row.user_id);
        }
        setDocAutorizaciones(map);
      });
  }, [selectedUsuario, documentos]);

  // Cargar usuarios autorizables
  useEffect(() => {
    supabase.rpc('get_crm_authorizable_users').then(({ data }) => {
      setAutorizables((data ?? []) as AutorizableUser[]);
    });
  }, []);

  // Buscador en tiempo real
  useEffect(() => {
    if (!userSearchQuery.trim()) { setUserSearchResults([]); return; }
    const q = userSearchQuery.toLowerCase();
    setUserSearchResults(usuarios.filter((u) =>
      u.nombre.toLowerCase().includes(q) ||
      (u.apellidos ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    ));
  }, [userSearchQuery, usuarios]);

  // Click fuera del buscador
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setUserSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
  const handleDeleteUsuario = async (id: string) => {
    if (!confirm('¿Eliminar este usuario? Se borrarán sus notas y documentos.')) return;
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
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.nombre.toLowerCase().includes(q) || (u.apellidos ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
  });

  // === Documentos ===
  const openNewDoc = () => {
    setEditingDocId(null); setDocTitulo(''); setDocDescripcion('');
    setDocTipo(docSubTab === 'privados' ? 'privado' : 'publico');
    setDocArchivo(null); setDocError(''); setShowDocForm(true);
  };
  const handleSaveDoc = async () => {
    if (!selectedUsuario) return;
    if (!docTitulo.trim()) { setDocError('El título es obligatorio'); return; }
    setDocSaving(true); setDocError('');
    try {
      let archivoUrl = '';
      let archivoNombre = '';
      if (docArchivo) {
        const ext = docArchivo.name.split('.').pop() ?? '';
        const path = `crm/${selectedUsuario.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, docArchivo);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);
        archivoUrl = pub.publicUrl;
        archivoNombre = docArchivo.name;
      }
      if (editingDocId) {
        const { error } = await supabase.from('crm_documentos').update({
          titulo: docTitulo.trim(), descripcion: docDescripcion.trim(), tipo: docTipo,
          archivo_url: archivoUrl || undefined, archivo_nombre: archivoNombre || undefined,
        }).eq('id', editingDocId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_documentos').insert({
          usuario_servicio_id: selectedUsuario.id, titulo: docTitulo.trim(),
          descripcion: docDescripcion.trim(), tipo: docTipo,
          archivo_url: archivoUrl, archivo_nombre: archivoNombre, subido_por: currentUserNombre,
        });
        if (error) throw error;
      }
      setShowDocForm(false);
      // Recargar documentos
      const { data } = await supabase.from('crm_documentos')
        .select('id, usuario_servicio_id, titulo, descripcion, tipo, archivo_url, archivo_nombre, subido_por, created_at')
        .eq('usuario_servicio_id', selectedUsuario.id)
        .order('created_at', { ascending: false });
      setDocumentos((data ?? []) as CrmDocumento[]);
    } catch { setDocError('No se pudo guardar el documento.'); }
    finally { setDocSaving(false); }
  };
  const handleDeleteDoc = async (id: string) => {
    if (!confirm('¿Eliminar este documento?')) return;
    await supabase.from('crm_documentos').delete().eq('id', id);
    if (selectedUsuario) {
      const { data } = await supabase.from('crm_documentos')
        .select('id, usuario_servicio_id, titulo, descripcion, tipo, archivo_url, archivo_nombre, subido_por, created_at')
        .eq('usuario_servicio_id', selectedUsuario.id).order('created_at', { ascending: false });
      setDocumentos((data ?? []) as CrmDocumento[]);
    }
  };

  // === Autorizaciones ===
  const openAuthModal = (docId: string) => {
    setAuthDocId(docId); setShowAuthModal(true);
  };
  const toggleAuth = async (userId: string) => {
    if (!authDocId) return;
    const current = docAutorizaciones[authDocId] ?? [];
    if (current.includes(userId)) {
      await supabase.from('crm_documentos_autorizaciones').delete()
        .eq('documento_id', authDocId).eq('user_id', userId);
      setDocAutorizaciones((prev) => ({ ...prev, [authDocId]: current.filter((u) => u !== userId) }));
    } else {
      await supabase.from('crm_documentos_autorizaciones').insert({ documento_id: authDocId, user_id: userId });
      setDocAutorizaciones((prev) => ({ ...prev, [authDocId]: [...current, userId] }));
    }
  };

  // Documentos filtrados por subtab
  const docsFiltered = documentos.filter((d) => docSubTab === 'publicos' ? d.tipo === 'publico' : d.tipo === 'privado');

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
              <option value="usuarios">Usuarios de Servicio</option>
              <option value="calendario">Calendario y Notas</option>
              <option value="documentos">Documentos</option>
              <option value="ayuda">Ayuda</option>
            </select>
          </div>
        </div>
        <div className="hidden md:flex flex-wrap gap-1 p-1 rounded-xl mb-6 sm:mb-8" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {([
            { id: 'usuarios', label: 'Usuarios de Servicio', icon: Users },
            { id: 'calendario', label: 'Calendario y Notas', icon: Calendar },
            { id: 'documentos', label: 'Documentos', icon: FolderOpen },
            { id: 'ayuda', label: 'Ayuda', icon: AlertCircle },
          ] as const).map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                style={{ backgroundColor: isActive ? '#0369A1' : 'transparent', color: isActive ? '#FFFFFF' : '#64748B' }}>
                <TabIcon size={13} />{tab.label}
              </button>
            );
          })}
        </div>

        {/* === Buscador de usuario (compartido calendario + documentos) === */}
        {(activeTab === 'calendario' || activeTab === 'documentos') && (
          <div className="mb-6">
            <label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>Buscar usuario de servicio</label>
            <div ref={searchRef} className="relative max-w-xl">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <Search size={16} style={{ color: '#64748B' }} />
                <input type="text" value={userSearchQuery}
                  onChange={(e) => { setUserSearchQuery(e.target.value); setUserSearchFocused(true); }}
                  onFocus={() => setUserSearchFocused(true)}
                  placeholder="Escribe nombre, apellidos o email..."
                  className="flex-1 bg-transparent text-sm outline-none" style={{ color: '#0F172A' }} />
                {selectedUsuario && (
                  <button onClick={() => { setSelectedUsuario(null); setUserSearchQuery(''); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                    <X size={10} /> Limpiar
                  </button>
                )}
              </div>
              {userSearchFocused && userSearchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 max-h-64 overflow-y-auto"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  {userSearchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm" style={{ color: '#94A3B8' }}>Sin resultados</div>
                  ) : userSearchResults.map((u) => (
                    <button key={u.id}
                      onClick={() => { setSelectedUsuario(u); setUserSearchQuery(`${u.nombre} ${u.apellidos ?? ''}`); setUserSearchFocused(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-all flex items-center gap-3"
                      style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                        <User size={14} style={{ color: '#0369A1' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#0F172A' }}>{u.nombre} {u.apellidos}</p>
                        {u.email && <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{u.email}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedUsuario && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <User size={14} style={{ color: '#0369A1' }} />
                <span className="text-sm font-medium" style={{ color: '#0369A1' }}>Seleccionado: {selectedUserLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* === Tab: Usuarios === */}
        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Usuarios de Servicio</h2>
                <p className="text-sm" style={{ color: '#64748B' }}>Gestiona los clientes/usuarios asignados a centros</p>
              </div>
              <button onClick={openNewUsuario}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                <Plus size={14} />Nuevo usuario
              </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <Search size={16} style={{ color: '#64748B' }} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, apellidos o email..."
                className="flex-1 bg-transparent text-sm outline-none" style={{ color: '#0F172A' }} />
            </div>
            {usuariosLoading ? (
              <div className="text-center py-12"><Clock size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /><p className="text-sm" style={{ color: '#64748B' }}>Cargando usuarios...</p></div>
            ) : filteredUsuarios.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
                <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay usuarios de servicio</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsuarios.map((u) => (
                  <div key={u.id} className="rounded-xl p-5 transition-all hover:shadow-md" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                          <User size={18} style={{ color: '#0369A1' }} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{u.nombre} {u.apellidos}</p>
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: u.activo ? '#F0FDF4' : '#FEF2F2', color: u.activo ? '#16A34A' : '#DC2626' }}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                        </div>
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
                    <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                      <button onClick={() => { setSelectedUsuario(u); setUserSearchQuery(`${u.nombre} ${u.apellidos ?? ''}`); setActiveTab('calendario'); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                        <Calendar size={12} />Ver calendario
                      </button>
                      <button onClick={() => { setSelectedUsuario(u); setUserSearchQuery(`${u.nombre} ${u.apellidos ?? ''}`); setActiveTab('documentos'); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                        <FolderOpen size={12} />Documentos
                      </button>
                      <button onClick={() => openEditUsuario(u)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>Editar</button>
                      <button onClick={() => handleDeleteUsuario(u.id)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ml-auto" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showUsuarioForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingId ? 'Editar usuario' : 'Nuevo usuario de servicio'}</h3>
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
          </div>
        )}

        {/* === Tab: Calendario === */}
        {activeTab === 'calendario' && (
          <div className="space-y-6">
            {selectedUsuario ? (
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
            ) : (
              <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <Calendar size={40} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
                <p className="text-sm font-medium" style={{ color: '#475569' }}>Usa el buscador de arriba para seleccionar un usuario</p>
              </div>
            )}
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

        {/* === Tab: Documentos === */}
        {activeTab === 'documentos' && (
          <div className="space-y-6">
            {selectedUsuario ? (
              <>
                {/* Subtabs Publico/Privado */}
                <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  {([
                    { id: 'publicos', label: 'Públicos', icon: Unlock },
                    { id: 'privados', label: 'Privados', icon: Lock },
                  ] as const).map((sub) => {
                    const SubIcon = sub.icon;
                    const isActive = docSubTab === sub.id;
                    return (
                      <button key={sub.id} onClick={() => setDocSubTab(sub.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                        style={{ backgroundColor: isActive ? (sub.id === 'publicos' ? '#16A34A' : '#D97706') : 'transparent', color: isActive ? '#FFFFFF' : '#64748B' }}>
                        <SubIcon size={14} />{sub.label}
                      </button>
                    );
                  })}
                  <button onClick={openNewDoc}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all ml-auto"
                    style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                    <Plus size={14} />Nuevo documento
                  </button>
                </div>

                {/* Info banner */}
                {docSubTab === 'publicos' ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <Unlock size={16} style={{ color: '#16A34A' }} />
                    <p className="text-sm" style={{ color: '#15803D' }}>Los documentos públicos son visibles para cualquier usuario con acceso al CRM.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <Lock size={16} style={{ color: '#D97706' }} />
                    <p className="text-sm" style={{ color: '#92400E' }}>Los documentos privados solo son visibles para supervisores y usuarios expresamente autorizados.</p>
                  </div>
                )}

                {/* Lista de documentos */}
                {docsLoading ? (
                  <div className="text-center py-12"><Clock size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /><p className="text-sm" style={{ color: '#64748B' }}>Cargando documentos...</p></div>
                ) : docsFiltered.length === 0 ? (
                  <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <FolderOpen size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
                    <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay documentos {docSubTab === 'publicos' ? 'públicos' : 'privados'}</p>
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Crea uno con el botón "Nuevo documento"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docsFiltered.map((d) => (
                      <div key={d.id} className="rounded-xl p-5 transition-all hover:shadow-md" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: d.tipo === 'publico' ? '#F0FDF4' : '#FFFBEB' }}>
                              {d.tipo === 'publico' ? <Unlock size={18} style={{ color: '#16A34A' }} /> : <Lock size={18} style={{ color: '#D97706' }} />}
                            </div>
                            <div>
                              <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{d.titulo}</p>
                              <p className="text-xs" style={{ color: '#94A3B8' }}>Subido por {d.subido_por}</p>
                            </div>
                          </div>
                        </div>
                        {d.descripcion && <p className="text-xs mb-3 line-clamp-2" style={{ color: '#64748B' }}>{d.descripcion}</p>}
                        {d.archivo_url && (
                          <a href={d.archivo_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium mb-3 inline-flex cursor-pointer transition-all"
                            style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                            <Download size={12} />{d.archivo_nombre || 'Descargar'}
                          </a>
                        )}
                        {d.tipo === 'privado' && (
                          <div className="mb-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Shield size={12} style={{ color: '#D97706' }} />
                              <span className="text-xs font-medium" style={{ color: '#92400E' }}>Autorizados: {(docAutorizaciones[d.id] ?? []).length}</span>
                            </div>
                            <button onClick={() => openAuthModal(d.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer transition-all"
                              style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                              <Eye size={10} />Gestionar autorizaciones
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                          <button onClick={() => { setEditingDocId(d.id); setDocTitulo(d.titulo); setDocDescripcion(d.descripcion); setDocTipo(d.tipo as 'publico' | 'privado'); setDocArchivo(null); setDocError(''); setShowDocForm(true); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all" style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>Editar</button>
                          <button onClick={() => handleDeleteDoc(d.id)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ml-auto" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Doc Form Modal */}
                {showDocForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingDocId ? 'Editar documento' : 'Nuevo documento'}</h3>
                        <button onClick={() => setShowDocForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
                      </div>
                      <div className="space-y-4">
                        <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Título *</label><input type="text" value={docTitulo} onChange={(e) => setDocTitulo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                        <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Descripción</label><textarea value={docDescripcion} onChange={(e) => setDocDescripcion(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }} /></div>
                        <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Visibilidad</label>
                          <div className="flex gap-2">
                            <button onClick={() => setDocTipo('publico')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all" style={{ backgroundColor: docTipo === 'publico' ? '#16A34A' : '#F1F5F9', color: docTipo === 'publico' ? '#FFFFFF' : '#475569', border: `1px solid ${docTipo === 'publico' ? '#16A34A' : '#E2E8F0'}` }}><Unlock size={12} />Público</button>
                            <button onClick={() => setDocTipo('privado')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all" style={{ backgroundColor: docTipo === 'privado' ? '#D97706' : '#F1F5F9', color: docTipo === 'privado' ? '#FFFFFF' : '#475569', border: `1px solid ${docTipo === 'privado' ? '#D97706' : '#E2E8F0'}` }}><Lock size={12} />Privado</button>
                          </div>
                        </div>
                        <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Archivo</label>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: '1px dashed #CBD5E1', backgroundColor: '#F8FAFC' }}>
                            <Upload size={14} style={{ color: '#94A3B8' }} />
                            <input type="file" onChange={(e) => setDocArchivo(e.target.files?.[0] ?? null)} className="text-xs" style={{ color: '#475569' }} />
                          </div>
                        </div>
                        {docError && <p className="text-xs" style={{ color: '#DC2626' }}>{docError}</p>}
                        <div className="flex gap-2">
                          <button onClick={handleSaveDoc} disabled={docSaving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{docSaving ? 'Guardando...' : 'Guardar'}</button>
                          <button onClick={() => setShowDocForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auth Modal */}
                {showAuthModal && authDocId && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <div className="w-full max-w-md rounded-2xl p-6 max-h-[80vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2"><Shield size={16} style={{ color: '#D97706' }} /><h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Gestionar autorizaciones</h3></div>
                        <button onClick={() => setShowAuthModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
                      </div>
                      <p className="text-xs mb-4" style={{ color: '#64748B' }}>Selecciona qué usuarios pueden ver este documento privado. Los supervisores tienen acceso automático.</p>
                      {autorizables.length === 0 ? (
                        <p className="text-sm text-center py-4" style={{ color: '#94A3B8' }}>No hay usuarios autorizables</p>
                      ) : (
                        <div className="space-y-2">
                          {autorizables.map((u) => {
                            const isAuth = (docAutorizaciones[authDocId] ?? []).includes(u.id);
                            return (
                              <button key={u.id} onClick={() => toggleAuth(u.id)}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                                style={{ backgroundColor: isAuth ? '#FFFBEB' : '#F8FAFC', border: `1px solid ${isAuth ? '#FDE68A' : '#E2E8F0'}` }}>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isAuth ? '#FEF3C7' : '#F1F5F9' }}><User size={14} style={{ color: isAuth ? '#D97706' : '#64748B' }} /></div>
                                  <div><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{u.nombre}</p><p className="text-xs" style={{ color: '#94A3B8' }}>{u.email} · {u.role}</p></div>
                                </div>
                                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: isAuth ? '#D97706' : 'transparent', border: `1.5px solid ${isAuth ? '#D97706' : '#CBD5E1'}` }}>
                                  {isAuth && <span style={{ color: '#FFFFFF', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <FolderOpen size={40} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
                <p className="text-sm font-medium" style={{ color: '#475569' }}>Usa el buscador de arriba para seleccionar un usuario</p>
              </div>
            )}
          </div>
        )}

        {/* === Tab: Ayuda === */}
        {activeTab === 'ayuda' && <HelpPanel currentProfileName="CRM" accentColor="#0369A1" />}
      </div>
    </div>
  );
}
