import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Eye, Pencil, KeyRound, X, Loader2, AlertCircle, Check, ChevronDown, UserPlus } from 'lucide-react';
import PinChangeModal from './PinChangeModal';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  estado: string;
  pin?: string | null;
  empleado_id?: string | null;
  society_ids?: string[];
  created_at: string;
}

interface Society {
  id: string;
  name: string;
}

interface Plantilla {
  id: string;
  nombre: string;
  asunto: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Admin', color: '#1E40AF', bg: '#DBEAFE' },
  rrhh: { label: 'RRHH', color: '#065F46', bg: '#D1FAE5' },
  empleado: { label: 'Empleado', color: '#92400E', bg: '#FEF3C7' },
  supervisor: { label: 'Supervisor', color: '#6B21A8', bg: '#F3E8FF' },
};

const SOCIETY_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

function societyColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % SOCIETY_COLORS.length;
  return SOCIETY_COLORS[h];
}

function SendIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SendTemplateModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    supabase.from('email_plantillas').select('id, nombre, asunto').eq('activo', true).then(({ data }) => {
      if (data) setPlantillas(data);
    });
  }, []);

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-template-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          plantillaId: selected,
          destinatario: { id: user.id, email: user.email, nombre: user.full_name },
        }),
      });
      const json = await res.json();
      if (!res.ok) setResult({ ok: false, msg: json.error ?? 'Error desconocido' });
      else setResult({ ok: true, msg: json.message ?? 'Correo enviado correctamente' });
    } catch (e: unknown) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Error de red' });
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <SendIcon size={15} />
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Enviar Correo</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
            <X size={15} style={{ color: '#64748B' }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="px-3 py-2.5 rounded-xl text-sm" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
            <p className="font-semibold" style={{ color: '#0284C7' }}>{user.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#38BDF8' }}>{user.email}</p>
          </div>
          {result && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
              style={{ backgroundColor: result.ok ? '#F0FDF4' : '#FEF2F2', color: result.ok ? '#16A34A' : '#B91C1C', border: `1px solid ${result.ok ? '#86EFAC' : '#FECACA'}` }}>
              {result.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              {result.msg}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Plantilla de correo</label>
            {plantillas.length === 0 ? (
              <p className="text-sm" style={{ color: '#94A3B8' }}>No hay plantillas activas configuradas</p>
            ) : (
              <div className="relative">
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm outline-none pr-9"
                  style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                >
                  <option value="">Seleccionar plantilla...</option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button
            onClick={handleSend}
            disabled={!selected || sending || !!result?.ok}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
          >
            {sending && <Loader2 size={14} className="animate-spin" />}
            {result?.ok ? 'Enviado' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, societies, onClose, onSaved }: { user: UserProfile; societies: Society[]; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [estado, setEstado] = useState(user.estado);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const { error: e } = await supabase.from('user_profiles').update({ full_name: fullName, role, estado, updated_at: new Date().toISOString() }).eq('id', user.id);
    setSaving(false);
    if (e) { setError(e.message); return; }
    onSaved();
    onClose();
  };

  const inp = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none';
  const inpS = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Editar Usuario</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100"><X size={15} style={{ color: '#64748B' }} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}><AlertCircle size={14} />{error}</div>}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Nombre</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inp} style={inpS} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Rol</label>
            <div className="relative">
              <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inp} appearance-none pr-9`} style={inpS}>
                <option value="empleado">Empleado</option>
                <option value="rrhh">RRHH</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Estado</label>
            <div className="relative">
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${inp} appearance-none pr-9`} style={inpS}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="pendiente">Pendiente</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [sendModal, setSendModal] = useState<UserProfile | null>(null);
  const [editModal, setEditModal] = useState<UserProfile | null>(null);
  const [pinModal, setPinModal] = useState<UserProfile | null>(null);
  const [viewUser, setViewUser] = useState<UserProfile | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: usersData }, { data: socData }] = await Promise.all([
      supabase.from('user_profiles').select('*').order('full_name'),
      supabase.from('sociedades').select('id, name'),
    ]);
    if (usersData) setUsers(usersData);
    if (socData) setSocieties(socData);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchQ = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchR = !roleFilter || u.role === roleFilter;
    const matchE = !estadoFilter || u.estado === estadoFilter;
    return matchQ && matchR && matchE;
  });

  const getUserSocieties = (u: UserProfile) => {
    if (!u.society_ids?.length) return [];
    return societies.filter((s) => u.society_ids!.includes(s.id));
  };

  const sinAcceso = users.filter((u) => !u.email).length;

  const btnS: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', cursor: 'pointer', transition: 'background 0.15s',
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      {sendModal && <SendTemplateModal user={sendModal} onClose={() => setSendModal(null)} />}
      {editModal && <EditUserModal user={editModal} societies={societies} onClose={() => setEditModal(null)} onSaved={load} />}
      {pinModal && <PinChangeModal userId={pinModal.id} userName={pinModal.full_name} currentPin={pinModal.pin} onClose={() => setPinModal(null)} onSaved={load} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Gestión de Usuarios</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>{users.length} usuarios registrados · {sinAcceso} empleados sin acceso</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
          <UserPlus size={16} />
          Nuevo Usuario
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo..."
          className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
        />
        <div className="relative">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
            <option value="">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="rrhh">RRHH</option>
            <option value="supervisor">Supervisor</option>
            <option value="empleado">Empleado</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
        </div>
        <div className="relative">
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <div className="grid text-xs font-bold uppercase tracking-wider px-5 py-3" style={{ gridTemplateColumns: '1fr 120px 140px 70px 100px 120px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
          <span>Usuario</span>
          <span>Rol</span>
          <span>Sociedades</span>
          <span>PIN</span>
          <span>Estado</span>
          <span className="text-right">Acc.</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#94A3B8' }}>
            <Loader2 size={18} className="animate-spin" /> Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>No se encontraron usuarios</div>
        ) : (
          filtered.map((u, i) => {
            const roleInfo = ROLE_LABELS[u.role] ?? { label: u.role, color: '#374151', bg: '#F3F4F6' };
            const userSocs = getUserSocieties(u);
            return (
              <div key={u.id} className="grid items-center px-5 py-3.5" style={{ gridTemplateColumns: '1fr 120px 140px 70px 100px 120px', borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white" style={{ backgroundColor: '#0F172A' }}>
                    {(u.full_name ?? u.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{u.full_name ?? '—'}</p>
                    <p className="text-xs truncate" style={{ color: '#64748B' }}>{u.email}</p>
                  </div>
                </div>
                <div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: roleInfo.bg, color: roleInfo.color }}>
                    {roleInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {userSocs.length === 0 ? (
                    <span style={{ color: '#CBD5E1' }}>—</span>
                  ) : (
                    userSocs.map((s) => (
                      <div key={s.id} title={s.name} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: societyColor(s.name) }}>
                        {s.name[0].toUpperCase()}
                      </div>
                    ))
                  )}
                </div>
                <div className="text-sm font-mono" style={{ color: u.pin ? '#0F172A' : '#CBD5E1' }}>
                  {u.pin ? '●●●●' : '—'}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: u.estado === 'activo' ? '#10B981' : u.estado === 'inactivo' ? '#EF4444' : '#F59E0B' }} />
                  <span className="text-sm capitalize" style={{ color: '#374151' }}>{u.estado ?? '—'}</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    title="Enviar correo de plantilla"
                    onClick={() => setSendModal(u)}
                    style={{ ...btnS, backgroundColor: '#EFF6FF', color: '#3B82F6' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#DBEAFE')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#EFF6FF')}
                  >
                    <SendIcon size={13} />
                  </button>
                  <button
                    title="Ver usuario"
                    onClick={() => setViewUser(u)}
                    style={{ ...btnS, backgroundColor: '#F0FDF4', color: '#10B981' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#DCFCE7')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    title="Editar usuario"
                    onClick={() => setEditModal(u)}
                    style={{ ...btnS, backgroundColor: '#FFFBEB', color: '#F59E0B' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF3C7')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFBEB')}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    title="Cambiar PIN"
                    onClick={() => setPinModal(u)}
                    style={{ ...btnS, backgroundColor: '#F0F9FF', color: '#0EA5E9' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E0F2FE')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F0F9FF')}
                  >
                    <KeyRound size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl bg-white overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Detalle de Usuario</h2>
              <button onClick={() => setViewUser(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100"><X size={15} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                ['Nombre', viewUser.full_name],
                ['Email', viewUser.email],
                ['Rol', ROLE_LABELS[viewUser.role]?.label ?? viewUser.role],
                ['Estado', viewUser.estado],
                ['PIN configurado', viewUser.pin ? 'Sí' : 'No'],
                ['Creado', new Date(viewUser.created_at).toLocaleDateString('es-ES')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span style={{ color: '#64748B' }}>{k}</span>
                  <span className="font-medium" style={{ color: '#0F172A' }}>{v ?? '—'}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setViewUser(null)} className="w-full py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
