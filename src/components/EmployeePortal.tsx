import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, KeyRound, LogOut, Key, FileText, Shield, Award,
  ClipboardList, LayoutDashboard, AlertCircle, Loader2,
  ChevronDown, Check, X, Download, Calendar, Building2,
  Laptop, User,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import PinChangeModal from './PinChangeModal';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  role: string;
  pin: string | null;
  societies: string[];
}

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  id_sociedad: string | null;
}

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  leida: boolean;
  created_at: string;
}

interface Nomina {
  id: string;
  anio: number;
  mes: number;
  nombre_archivo: string;
  wasabi_key: string;
  sociedad_nombre: string | null;
  created_at: string;
}

interface Dispositivo {
  id: string;
  tipo: string;
  marca_modelo: string;
  estado_id: number;
  etiquetado: string | null;
}

interface Incidencia {
  id: string;
  numero: number;
  titulo: string;
  estado: string;
  fecha_creacion: string;
}

// ─── Month names ───────────────────────────────────────────────────────────────

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const TIPO_NOTIF_ICON: Record<string, string> = {
  nueva_nomina:          '💰',
  nuevo_documento:       '📄',
  nuevo_documento_prl:   '🛡️',
  vacacion_aprobada:     '✅',
  vacacion_rechazada:    '❌',
  incidencia_creada:     '⚠️',
  incidencia_resuelta:   '✔️',
  email:                 '📧',
};

// ─── Notifications Dropdown ────────────────────────────────────────────────────

function NotificationsDropdown({
  notificaciones, onMarkRead, onClose,
}: {
  notificaciones: Notificacion[];
  onMarkRead: () => void;
  onClose: () => void;
}) {
  const unread = notificaciones.filter((n) => !n.leida);

  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl z-50 overflow-hidden"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-2">
          <Bell size={14} style={{ color: '#0F172A' }} />
          <span className="font-semibold text-sm" style={{ color: '#0F172A' }}>Notificaciones</span>
          {unread.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>{unread.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button onClick={onMarkRead} className="text-xs font-medium" style={{ color: '#0EA5E9' }}>
              Marcar leídas
            </button>
          )}
          <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100">
            <X size={12} style={{ color: '#64748B' }} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
        {notificaciones.length === 0 ? (
          <div className="text-center py-10">
            <Bell size={24} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
            <p className="text-xs" style={{ color: '#94A3B8' }}>Sin notificaciones</p>
          </div>
        ) : (
          notificaciones.map((n) => (
            <div key={n.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
              style={{ borderBottom: '1px solid #F8FAFC', opacity: n.leida ? 0.6 : 1 }}>
              <span className="text-lg flex-shrink-0 mt-0.5">
                {TIPO_NOTIF_ICON[n.tipo] ?? '🔔'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{n.titulo}</p>
                  {!n.leida && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: '#0EA5E9' }} />}
                </div>
                {n.descripcion && <p className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{n.descripcion}</p>}
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                  {new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function EmployeePortal() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [sociedadNombre, setSociedadNombre] = useState('');
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumen');
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const [{ data: profile }, { data: emp }] = await Promise.all([
      supabase.from('user_profiles').select('id, nombre, email, role, pin, societies').eq('id', authUser.id).single(),
      supabase.from('empleados').select('id, nombre, dni, id_sociedad').eq('user_id', authUser.id).maybeSingle(),
    ]);

    if (profile) setUser(profile as UserProfile);
    if (emp) {
      setEmpleado(emp as Empleado);
      if ((emp as Empleado).id_sociedad) {
        const { data: soc } = await supabase.from('sociedades').select('nombre').eq('id', (emp as Empleado).id_sociedad!).single();
        setSociedadNombre(soc?.nombre ?? '');
      }
    }
  }, []);

  const loadNotificaciones = useCallback(async () => {
    const { data } = await supabase
      .from('notificaciones_empleado')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setNotificaciones((data ?? []) as Notificacion[]);
  }, []);

  const loadTabData = useCallback(async (tab: string, dni: string | null, empleadoId: string | null) => {
    if (tab === 'nominas' && dni) {
      const { data } = await supabase.from('nominas').select('*').eq('dni', dni).order('anio', { ascending: false }).order('mes', { ascending: false });
      setNominas((data ?? []) as Nomina[]);
    }
    if (tab === 'resumen' && empleadoId) {
      const { data } = await supabase.from('dispositivos').select('id, tipo, marca_modelo, estado_id, etiquetado').eq('empleado_id', empleadoId);
      setDispositivos((data ?? []) as Dispositivo[]);
    }
    if (tab === 'incidencias') {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data } = await supabase.from('incidencias').select('id, numero, titulo, estado, fecha_creacion').eq('creado_por_id', authUser.id).order('fecha_creacion', { ascending: false }).limit(20);
      setIncidencias((data ?? []) as Incidencia[]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadUser().then(() => setLoading(false));
    loadNotificaciones();
  }, [loadUser, loadNotificaciones]);

  useEffect(() => {
    if (empleado) {
      loadTabData(activeTab, empleado.dni, empleado.id);
    }
  }, [activeTab, empleado, loadTabData]);

  const handleMarkAllRead = async () => {
    const unreadIds = notificaciones.filter((n) => !n.leida).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notificaciones_empleado').update({ leida: true }).in('id', unreadIds);
    loadNotificaciones();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleDownloadNomina = async (nomina: Nomina) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wasabi-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ key: nomina.wasabi_key }),
    });
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, '_blank');
  };

  const unreadCount = notificaciones.filter((n) => !n.leida).length;

  const TABS = [
    { key: 'resumen',      label: 'Resumen',           icon: LayoutDashboard },
    { key: 'nominas',      label: 'Mis Nominas',        icon: FileText        },
    { key: 'prl',          label: 'Documentos PRL',     icon: Shield          },
    { key: 'certificados', label: 'Mis Certificados',   icon: Award           },
    { key: 'examenes',     label: 'Mis Examenes',       icon: ClipboardList   },
    { key: 'incidencias',  label: 'Incidencias',        icon: AlertCircle     },
  ];

  const ESTADO_INCIDENCIA: Record<string, { label: string; color: string; bg: string }> = {
    abierta:    { label: 'Abierta',    color: '#D97706', bg: '#FFFBEB' },
    en_proceso: { label: 'En proceso', color: '#2563EB', bg: '#EFF6FF' },
    resuelta:   { label: 'Resuelta',   color: '#16A34A', bg: '#F0FDF4' },
    cerrada:    { label: 'Cerrada',    color: '#64748B', bg: '#F8FAFC' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#0EA5E9' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EFF3F8' }}>
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header style={{ backgroundColor: '#0F172A' }}>
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#1E293B' }}>
              <Building2 size={18} style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: '#FFFFFF' }}>
                {sociedadNombre || user?.nombre?.split(' ')[0] || 'Portal'}
              </p>
              <p className="text-xs" style={{ color: '#64748B' }}>Portal del Empleado</p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => { setShowNotifs((v) => !v); setShowProfileMenu(false); }}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors">
                <Bell size={17} style={{ color: '#94A3B8' }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: '10px' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <NotificationsDropdown
                  notificaciones={notificaciones}
                  onMarkRead={handleMarkAllRead}
                  onClose={() => setShowNotifs(false)}
                />
              )}
            </div>

            {/* Profile menu */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfileMenu((v) => !v); setShowNotifs(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-700 transition-colors">
                <div className="text-right">
                  <p className="text-xs font-medium leading-tight" style={{ color: '#E2E8F0' }}>
                    {user?.email ? (user.email.length > 20 ? user.email.slice(0, 20) + '...' : user.email) : ''}
                  </p>
                  <p className="text-xs capitalize" style={{ color: '#64748B' }}>Empleado</p>
                </div>
                <ChevronDown size={13} style={{ color: '#64748B' }} />
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-xl z-50 overflow-hidden"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{user?.nombre}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setShowPinModal(true); setShowProfileMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors text-left">
                      <KeyRound size={15} style={{ color: '#7C3AED' }} />
                      <span style={{ color: '#0F172A' }}>Cambiar PIN</span>
                      {user?.pin && (
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Configurado</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Change password */}
            <button
              onClick={async () => {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser?.email) {
                  await supabase.auth.resetPasswordForEmail(authUser.email);
                  alert('Se ha enviado un correo para cambiar la contraseña');
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-slate-700"
              style={{ color: '#94A3B8' }}>
              <Key size={14} />
              <span className="hidden sm:inline">Cambiar Contrasena</span>
            </button>

            {/* Sign out */}
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-slate-700"
              style={{ color: '#94A3B8' }}>
              <LogOut size={14} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <main className="px-6 py-6 max-w-6xl mx-auto">
        {/* Welcome */}
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: '#0F172A' }}>
            Bienvenido, {user?.nombre ?? 'Empleado'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Resumen de tus recursos y solicitudes</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={{
                backgroundColor: activeTab === key ? '#0F172A' : '#FFFFFF',
                color: activeTab === key ? '#FFFFFF' : '#64748B',
                border: `1px solid ${activeTab === key ? '#0F172A' : '#E2E8F0'}`,
              }}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Resumen ─────────────────────────────────────────────────────────── */}
        {activeTab === 'resumen' && (
          <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Documentos',      value: '—',                             color: '#0F172A' },
                { label: 'Dispositivos',    value: dispositivos.length,              color: '#0EA5E9' },
                { label: 'Docs. Prevencion', value: '—',                            color: '#0F172A' },
                { label: 'Certificados',    value: '0',                              color: '#0EA5E9' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Detail cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Mis Documentos */}
              <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={15} style={{ color: '#64748B' }} />
                    <span className="font-semibold text-sm" style={{ color: '#0F172A' }}>Mis Documentos</span>
                  </div>
                  <button onClick={() => setActiveTab('nominas')} className="text-xs font-medium" style={{ color: '#0EA5E9' }}>Ver todos</button>
                </div>
                <p className="text-xs" style={{ color: '#94A3B8' }}>0 documentos disponibles</p>
                <div className="mt-3 text-center py-4">
                  <FileText size={24} className="mx-auto mb-1" style={{ color: '#E2E8F0' }} />
                  <p className="text-xs" style={{ color: '#CBD5E1' }}>Sin documentos disponibles</p>
                </div>
              </div>

              {/* Mis Dispositivos */}
              <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Laptop size={15} style={{ color: '#64748B' }} />
                  <span className="font-semibold text-sm" style={{ color: '#0F172A' }}>Mis Dispositivos</span>
                </div>
                {dispositivos.length === 0 ? (
                  <p className="text-xs" style={{ color: '#94A3B8' }}>0 dispositivos asignados</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                        {dispositivos.filter((d) => d.estado_id === 1).length} Activos
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                        {dispositivos.filter((d) => d.estado_id !== 1).length} Inactivos
                      </span>
                    </div>
                    {dispositivos.slice(0, 2).map((d) => (
                      <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                        <Laptop size={12} style={{ color: '#0EA5E9' }} />
                        <p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{d.marca_modelo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documentos Prevencion */}
              <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={15} style={{ color: '#64748B' }} />
                  <span className="font-semibold text-sm" style={{ color: '#0F172A' }}>Documentos Prevencion</span>
                </div>
                <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>0 documentos disponibles</p>
                <div className="text-center py-4">
                  <Shield size={24} className="mx-auto mb-1" style={{ color: '#E2E8F0' }} />
                  <p className="text-xs" style={{ color: '#CBD5E1' }}>Sin documentos de prevencion</p>
                  <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Tu responsable de PRL los subira aqui</p>
                </div>
              </div>

              {/* Vehiculo */}
              <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2 mb-3">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5" /><circle cx="16" cy="17" r="3" /><circle cx="7" cy="17" r="3" />
                  </svg>
                  <span className="font-semibold text-sm" style={{ color: '#0F172A' }}>Vehiculo Fichado</span>
                </div>
                <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>Sin vehiculo</p>
                <div className="text-center py-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth="2" className="mx-auto mb-1">
                    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5" /><circle cx="16" cy="17" r="3" /><circle cx="7" cy="17" r="3" />
                  </svg>
                  <p className="text-xs" style={{ color: '#CBD5E1' }}>No hay ningun vehiculo fichado actualmente</p>
                </div>
              </div>
            </div>

            {/* Recent notifications in resumen */}
            {notificaciones.filter((n) => !n.leida).length > 0 && (
              <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bell size={14} style={{ color: '#0EA5E9' }} />
                    <span className="font-semibold text-sm" style={{ color: '#0F172A' }}>Notificaciones sin leer</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                      {notificaciones.filter((n) => !n.leida).length}
                    </span>
                  </div>
                  <button onClick={handleMarkAllRead} className="text-xs font-medium" style={{ color: '#0EA5E9' }}>
                    Marcar todas como leídas
                  </button>
                </div>
                <div className="space-y-2">
                  {notificaciones.filter((n) => !n.leida).slice(0, 5).map((n) => (
                    <div key={n.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ backgroundColor: '#F0F9FF' }}>
                      <span className="text-base">{TIPO_NOTIF_ICON[n.tipo] ?? '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{n.titulo}</p>
                        {n.descripcion && <p className="text-xs truncate" style={{ color: '#64748B' }}>{n.descripcion}</p>}
                      </div>
                      <p className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>
                        {new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Nominas ─────────────────────────────────────────────────────────── */}
        {activeTab === 'nominas' && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid #E2E8F0' }}>
              {nominas.length === 0 ? (
                <div className="text-center py-14">
                  <FileText size={32} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
                  <p className="text-sm" style={{ color: '#94A3B8' }}>Sin nóminas disponibles</p>
                  {!empleado?.dni && <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Tu DNI no está vinculado. Contacta con RRHH.</p>}
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                  {nominas.map((n) => (
                    <div key={n.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0F9FF' }}>
                        <FileText size={15} style={{ color: '#0EA5E9' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                          Nómina {MESES[n.mes - 1]} {n.anio}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{n.nombre_archivo}</p>
                      </div>
                      {n.sociedad_nombre && (
                        <span className="text-xs px-2 py-1 rounded-full hidden sm:block" style={{ backgroundColor: '#F8FAFC', color: '#64748B' }}>
                          {n.sociedad_nombre}
                        </span>
                      )}
                      <p className="text-xs" style={{ color: '#94A3B8' }}>
                        {new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <button onClick={() => handleDownloadNomina(n)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: '#F0F9FF', color: '#0EA5E9' }}>
                        <Download size={12} /> Descargar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PRL ─────────────────────────────────────────────────────────────── */}
        {activeTab === 'prl' && (
          <div className="rounded-xl bg-white p-8 text-center" style={{ border: '1px solid #E2E8F0' }}>
            <Shield size={36} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Documentos PRL</p>
            <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Tu responsable de PRL subira aqui tus documentos de prevencion</p>
          </div>
        )}

        {/* ── Certificados ───────────────────────────────────────────────────── */}
        {activeTab === 'certificados' && (
          <div className="rounded-xl bg-white p-8 text-center" style={{ border: '1px solid #E2E8F0' }}>
            <Award size={36} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Mis Certificados</p>
            <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Aqui aparecerán tus certificados de formacion</p>
          </div>
        )}

        {/* ── Examenes ───────────────────────────────────────────────────────── */}
        {activeTab === 'examenes' && (
          <div className="rounded-xl bg-white p-8 text-center" style={{ border: '1px solid #E2E8F0' }}>
            <ClipboardList size={36} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Mis Examenes</p>
            <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Los examenes asignados aparecerán aqui</p>
          </div>
        )}

        {/* ── Incidencias ─────────────────────────────────────────────────────── */}
        {activeTab === 'incidencias' && (
          <div className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid #E2E8F0' }}>
            {incidencias.length === 0 ? (
              <div className="text-center py-14">
                <AlertCircle size={32} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>Sin incidencias registradas</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                {incidencias.map((inc) => {
                  const est = ESTADO_INCIDENCIA[inc.estado] ?? ESTADO_INCIDENCIA.abierta;
                  return (
                    <div key={inc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: est.bg }}>
                        <AlertCircle size={14} style={{ color: est.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>#{inc.numero} — {inc.titulo}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                          {new Date(inc.fecha_creacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: est.bg, color: est.color }}>
                        {est.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* PIN modal */}
      {showPinModal && user && (
        <PinChangeModal
          userId={user.id}
          userName={user.nombre}
          currentPin={user.pin}
          onClose={() => setShowPinModal(false)}
          onSaved={() => { setShowPinModal(false); loadUser(); }}
        />
      )}
    </div>
  );
}
