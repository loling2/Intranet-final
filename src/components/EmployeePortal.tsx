import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Bell, KeyRound, LogOut, ChevronDown, FileText, Download, Loader2, Check, X, User, Shield, Award, Stethoscope, ClipboardList } from 'lucide-react';
import PinChangeModal from './PinChangeModal';

interface Empleado {
  id: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  cargo?: string;
  departamento?: string;
  fecha_inicio?: string;
  society_id?: string;
}

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  descripcion?: string;
  leida: boolean;
  created_at: string;
}

interface Nomina {
  id: string;
  mes: string;
  anio: number;
  archivo_key?: string;
  importe_neto?: number;
}

interface Documento {
  id: string;
  nombre: string;
  archivo_key?: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  pin?: string | null;
  empleado_id?: string | null;
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const TIPO_ICON: Record<string, string> = { nomina: '💰', documento_prl: '🛡️', certificado: '🏆', examen: '🩺', email: '✉️', general: '📢' };

function NotifDropdown({ userId, onClose, onRead }: { userId: string; onClose: () => void; onRead: () => void }) {
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('notificaciones_empleado').select('*').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (data) setNotifs(data); setLoading(false); });
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    const ids = notifs.filter((n) => !n.leida).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from('notificaciones_empleado').update({ leida: true }).in('id', ids);
    setNotifs((p) => p.map((n) => ({ ...n, leida: true })));
    onRead();
  };

  const unread = notifs.filter((n) => !n.leida).length;

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl overflow-hidden z-50" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-2">
          <Bell size={14} style={{ color: '#0F172A' }} />
          <span className="font-bold text-sm" style={{ color: '#0F172A' }}>Notificaciones</span>
          {unread > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#EF4444', fontSize: 10 }}>{unread}</span>}
        </div>
        {unread > 0 && <button onClick={markAllRead} className="text-xs font-medium" style={{ color: '#0EA5E9', background: 'none', border: 'none', cursor: 'pointer' }}>Marcar leídas</button>}
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: '#94A3B8' }}><Loader2 size={16} className="animate-spin" /> Cargando...</div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: '#94A3B8' }}>Sin notificaciones</div>
        ) : notifs.map((n) => (
          <div key={n.id} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: n.leida ? '#FFFFFF' : '#F0F9FF' }}>
            <span className="text-base flex-shrink-0 mt-0.5">{TIPO_ICON[n.tipo] ?? '📢'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{n.titulo}</p>
              {n.descripcion && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{n.descripcion}</p>}
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
            {!n.leida && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: '#0EA5E9' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EmployeePortal() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [sociedadNombre, setSociedadNombre] = useState('Portal Empleado');
  const [tab, setTab] = useState('resumen');
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    init();
    const handler = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const init = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: prof } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
    if (!prof) { setLoading(false); return; }
    setProfile(prof);

    const { count } = await supabase.from('notificaciones_empleado').select('*', { count: 'exact', head: true }).eq('leida', false);
    setUnreadCount(count ?? 0);

    if (prof.empleado_id) {
      const { data: emp } = await supabase.from('empleados').select('*').eq('id', prof.empleado_id).maybeSingle();
      if (emp) {
        setEmpleado(emp);
        if (emp.society_id) {
          const { data: soc } = await supabase.from('sociedades').select('name').eq('id', emp.society_id).maybeSingle();
          if (soc) setSociedadNombre(soc.name);
        }
        const { data: noms } = await supabase.from('nominas').select('*').eq('dni', emp.dni).order('anio', { ascending: false });
        if (noms) setNominas(noms);
        const { data: docs } = await supabase.from('documentos_empleado').select('*').eq('empleado_id', emp.id).order('created_at', { ascending: false });
        if (docs) setDocumentos(docs);
      }
    }
    setLoading(false);
  };

  const downloadFile = async (key: string, filename: string) => {
    setDownloading(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wasabi-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ key }),
      });
      const json = await res.json();
      if (json.url) { const a = document.createElement('a'); a.href = json.url; a.download = filename; a.click(); }
    } catch (_) { /* silent */ }
    setDownloading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="flex items-center gap-2" style={{ color: '#64748B' }}><Loader2 size={20} className="animate-spin" /> Cargando portal...</div>
      </div>
    );
  }

  const TABS = [
    { id: 'resumen',      label: 'Resumen',         Icon: User },
    { id: 'nominas',      label: 'Mis Nóminas',      Icon: FileText },
    { id: 'prl',          label: 'Documentos PRL',   Icon: Shield },
    { id: 'certificados', label: 'Mis Certificados', Icon: Award },
    { id: 'examenes',     label: 'Mis Exámenes',     Icon: Stethoscope },
    { id: 'incidencias',  label: 'Incidencias',      Icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F1F5F9', fontFamily: 'Inter, sans-serif' }}>
      {showPinModal && profile && (
        <PinChangeModal userId={profile.id} userName={profile.full_name} currentPin={profile.pin} onClose={() => setShowPinModal(false)} onSaved={init} />
      )}

      {/* Header */}
      <header style={{ backgroundColor: '#0F172A', borderBottom: '1px solid #1E293B' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}>
              {sociedadNombre[0]?.toUpperCase() ?? 'P'}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: '#F8FAFC' }}>{sociedadNombre}</p>
              <p className="text-xs" style={{ color: '#64748B' }}>Portal del Empleado</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs((v) => !v); setShowProfile(false); }}
                style={{ position: 'relative', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: showNotifs ? '#1E293B' : 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <Bell size={16} style={{ color: '#CBD5E1' }} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <NotifDropdown
                  userId={profile?.id ?? ''}
                  onClose={() => setShowNotifs(false)}
                  onRead={() => setUnreadCount(0)}
                />
              )}
            </div>

            {/* Profile */}
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowProfile((v) => !v); setShowNotifs(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, backgroundColor: showProfile ? '#1E293B' : 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#0EA5E9', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                  {(empleado?.nombre ?? profile?.full_name ?? '?')[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#E2E8F0' }}>
                  {empleado ? `${empleado.nombre} ${empleado.apellidos}` : profile?.full_name ?? 'Usuario'}
                </span>
                <ChevronDown size={13} style={{ color: '#64748B' }} />
              </button>

              {showProfile && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 220, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', zIndex: 50, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{profile?.full_name ?? '—'}</p>
                    <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{profile?.email}</p>
                  </div>
                  <div style={{ padding: '4px 0' }}>
                    <button
                      onClick={() => { setShowPinModal(true); setShowProfile(false); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: '#374151', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <KeyRound size={14} style={{ color: '#0EA5E9' }} />
                      Cambiar PIN
                    </button>
                    <div style={{ borderTop: '1px solid #F1F5F9', margin: '4px 0' }} />
                    <button
                      onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <LogOut size={14} />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div className="max-w-6xl mx-auto px-6" style={{ display: 'flex', overflowX: 'auto' }}>
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 16px', fontSize: 13, fontWeight: tab === id ? 600 : 500, borderBottom: `2px solid ${tab === id ? '#0EA5E9' : 'transparent'}`, color: tab === id ? '#0EA5E9' : '#64748B', background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? '#0EA5E9' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'resumen' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Nóminas disponibles', value: nominas.length, color: '#0EA5E9', bg: '#F0F9FF' },
                { label: 'Documentos PRL', value: documentos.length, color: '#10B981', bg: '#F0FDF4' },
                { label: 'Notificaciones sin leer', value: unreadCount, color: '#F59E0B', bg: '#FFFBEB' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="rounded-2xl p-5" style={{ backgroundColor: bg, border: `1px solid ${color}30` }}>
                  <p className="text-sm" style={{ color }}>{label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: '#0F172A' }}>{value}</p>
                </div>
              ))}
            </div>
            {empleado && (
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <h3 className="font-bold mb-4" style={{ color: '#0F172A' }}>Mis Datos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['Nombre completo', `${empleado.nombre} ${empleado.apellidos}`],
                    ['DNI', empleado.dni],
                    ['Email', empleado.email],
                    ['Cargo', empleado.cargo ?? '—'],
                    ['Departamento', empleado.departamento ?? '—'],
                    ['Empresa', sociedadNombre],
                    ['Fecha de alta', empleado.fecha_inicio ? new Date(empleado.fecha_inicio).toLocaleDateString('es-ES') : '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>{k}</p>
                      <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'nominas' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <h2 className="font-bold" style={{ color: '#0F172A' }}>Mis Nóminas</h2>
            </div>
            {nominas.length === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: '#94A3B8' }}>No hay nóminas disponibles</div>
            ) : nominas.map((n, i) => (
              <div key={n.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: i < nominas.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F0F9FF' }}>
                    <FileText size={16} style={{ color: '#0EA5E9' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{MESES[(parseInt(n.mes) - 1)] ?? n.mes} {n.anio}</p>
                    {n.importe_neto != null && <p className="text-xs" style={{ color: '#64748B' }}>{n.importe_neto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>}
                  </div>
                </div>
                {n.archivo_key && (
                  <button onClick={() => downloadFile(n.archivo_key!, `nomina_${n.mes}_${n.anio}.pdf`)} disabled={downloading === n.archivo_key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#F0F9FF', color: '#0EA5E9', border: 'none', cursor: 'pointer' }}>
                    {downloading === n.archivo_key ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Descargar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'prl' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <h2 className="font-bold" style={{ color: '#0F172A' }}>Documentos PRL</h2>
            </div>
            {documentos.length === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: '#94A3B8' }}>No hay documentos disponibles</div>
            ) : documentos.map((d, i) => (
              <div key={d.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: i < documentos.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F0FDF4' }}>
                    <Shield size={16} style={{ color: '#10B981' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{d.nombre}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{new Date(d.created_at).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>
                {d.archivo_key && (
                  <button onClick={() => downloadFile(d.archivo_key!, d.nombre)} disabled={downloading === d.archivo_key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#F0FDF4', color: '#10B981', border: 'none', cursor: 'pointer' }}>
                    {downloading === d.archivo_key ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Descargar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {(tab === 'certificados' || tab === 'examenes' || tab === 'incidencias') && (
          <div className="rounded-2xl flex flex-col items-center justify-center py-20" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F8FAFC' }}>
              {tab === 'certificados' && <Award size={24} style={{ color: '#94A3B8' }} />}
              {tab === 'examenes' && <Stethoscope size={24} style={{ color: '#94A3B8' }} />}
              {tab === 'incidencias' && <ClipboardList size={24} style={{ color: '#94A3B8' }} />}
            </div>
            <p className="font-semibold text-sm" style={{ color: '#64748B' }}>Próximamente</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Esta sección estará disponible pronto</p>
          </div>
        )}
      </main>
    </div>
  );
}
