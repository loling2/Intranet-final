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
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin:      { label: 'Admin',      color: '#1E40AF', bg: '#DBEAFE' },
  rrhh:       { label: 'RRHH',       color: '#065F46', bg: '#D1FAE5' },
  empleado:   { label: 'Empleado',   color: '#92400E', bg: '#FEF3C7' },
  supervisor: { label: 'Supervisor', color: '#6B21A8', bg: '#F3E8FF' },
};

const SOC_COLORS = ['#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'];
function socColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % SOC_COLORS.length;
  return SOC_COLORS[h];
}

function SendEmailModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [selected, setSelected] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    supabase.from('email_plantillas').select('id, nombre').eq('activo', true).then(({ data }) => {
      if (data) { setPlantillas(data); if (data.length > 0) setSelected(data[0].id); }
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ plantillaId: selected, destinatario: { id: user.id, email: user.email, nombre: user.full_name } }),
      });
      const json = await res.json();
      setResult(res.ok ? { ok: true, msg: json.message ?? 'Correo enviado' } : { ok: false, msg: json.error ?? 'Error al enviar' });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Error de red' });
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            {/* paper-plane SVG */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Enviar correo</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100"><X size={15} style={{ color: '#64748B' }} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="px-3 py-2.5 rounded-xl text-sm" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
            <p className="font-semibold" style={{ color: '#0284C7' }}>{user.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#38BDF8' }}>{user.email}</p>
          </div>
          {result && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: result.ok ? '#F0FDF4' : '#FEF2F2', color: result.ok ? '#16A34A' : '#B91C1C', border: `1px solid ${result.ok ? '#86EFAC' : '#FECACA'}` }}>
              {result.ok ? <Check size={14} /> : <AlertCircle size={14} />} {result.msg}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Plantilla</label>
            {plantillas.length === 0 ? (
              <p className="text-sm" style={{ color: '#94A3B8' }}>No hay plantillas activas</p>
            ) : (
              <div className="relative">
                <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm outline-none pr-9" style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}>
                  {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button onClick={handleSend} disabled={!selected || sending || result?.ok} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}>
            {sending && <Loader2 size={14} className="animate-spin" />}
            {result?.ok ? 'Enviado' : 'Enviar'}
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
  const [viewModal, setViewModal] = useState<UserProfile | null>(null);
  const [editModal, setEditModal] = useState<UserProfile | null>(null);
  const [pinModal, setPinModal] = useState<UserProfile | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: u }, { data: s }] = await Promise.all([
      supabase.from('user_profiles').select('*').order('full_name'),
      supabase.from('sociedades').select('id, name'),
    ]);
    if (u) setUsers(u);
    if (s) setSocieties(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (!q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      && (!roleFilter || u.role === roleFilter)
      && (!estadoFilter || u.estado === estadoFilter);
  });

  const userSocs = (u: UserProfile) => societies.filter((s) => u.society_ids?.includes(s.id));

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      {sendModal && <SendEmailModal user={sendModal} onClose={() => setSendModal(null)} />}
      {pinModal && <PinChangeModal userId={pinModal.id} userName={pinModal.full_name} currentPin={pinModal.pin} onClose={() => setPinModal(null)} onSaved={load} />}

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl bg-white overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Editar Usuario</h2>
              <button onClick={() => setEditModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100"><X size={15} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Rol</label>
                <div className="relative">
                  <select
                    value={editModal.role}
                    onChange={(e) => setEditModal({ ...editModal, role: e.target.value })}
                    className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm outline-none pr-8"
                    style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                  >
                    <option value="empleado">Empleado</option>
                    <option value="rrhh">RRHH</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Estado</label>
                <div className="relative">
                  <select
                    value={editModal.estado}
                    onChange={(e) => setEditModal({ ...editModal, estado: e.target.value })}
                    className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm outline-none pr-8"
                    style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setEditModal(null)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
              <button
                onClick={async () => {
                  await supabase.from('user_profiles').update({ role: editModal.role, estado: editModal.estado }).eq('id', editModal.id);
                  setEditModal(null);
                  load();
                }}
                className="px-5 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl bg-white overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Detalle de Usuario</h2>
              <button onClick={() => setViewModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100"><X size={15} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[['Nombre', viewModal.full_name],['Email', viewModal.email],['Rol', ROLE_LABELS[viewModal.role]?.label ?? viewModal.role],['Estado', viewModal.estado],['PIN', viewModal.pin ? 'Configurado' : 'No configurado'],['Alta', new Date(viewModal.created_at).toLocaleDateString('es-ES')]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span style={{ color: '#64748B' }}>{k}</span>
                  <span className="font-medium" style={{ color: '#0F172A' }}>{v ?? '—'}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setViewModal(null)} className="w-full py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Gestión de Usuarios</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>{users.length} usuarios registrados · {users.filter((u) => !u.email).length} sin acceso</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o correo..." className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }} />
        <div className="relative">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
            <option value="">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="rrhh">RRHH</option>
            <option value="supervisor">Supervisor</option>
            <option value="empleado">Empleado</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
        </div>
        <div className="relative">
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <div className="grid text-xs font-bold uppercase tracking-wider px-5 py-3" style={{ gridTemplateColumns: '1fr 120px 140px 70px 100px 130px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
          <span>Usuario</span><span>Rol</span><span>Sociedades</span><span>PIN</span><span>Estado</span><span className="text-right">Acc.</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#94A3B8' }}><Loader2 size={18} className="animate-spin" /> Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>No se encontraron usuarios</div>
        ) : filtered.map((u, i) => {
          const ri = ROLE_LABELS[u.role] ?? { label: u.role, color: '#374151', bg: '#F3F4F6' };
          const socs = userSocs(u);
          return (
            <div key={u.id} className="grid items-center px-5 py-3.5" style={{ gridTemplateColumns: '1fr 120px 140px 70px 100px 130px', borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: '#0F172A' }}>
                  {(u.full_name ?? u.email ?? '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{u.full_name ?? '—'}</p>
                  <p className="text-xs truncate" style={{ color: '#64748B' }}>{u.email}</p>
                </div>
              </div>
              <div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: ri.bg, color: ri.color }}>{ri.label}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {socs.length === 0 ? <span style={{ color: '#CBD5E1' }}>—</span> : socs.map((s) => (
                  <div key={s.id} title={s.name} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: socColor(s.name) }}>
                    {s.name[0].toUpperCase()}
                  </div>
                ))}
              </div>
              <div className="text-sm font-mono" style={{ color: u.pin ? '#0F172A' : '#CBD5E1' }}>{u.pin ? '●●●●' : '—'}</div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: u.estado === 'activo' ? '#10B981' : u.estado === 'inactivo' ? '#EF4444' : '#F59E0B' }} />
                <span className="text-sm capitalize" style={{ color: '#374151' }}>{u.estado ?? '—'}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                {/* Send email — inline SVG guaranteed to render */}
                <button
                  title="Enviar correo"
                  onClick={() => setSendModal(u)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#EFF6FF', color: '#3B82F6', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#DBEAFE'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
                {/* View */}
                <button
                  title="Ver usuario"
                  onClick={() => setViewModal(u)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#F0FDF4', color: '#10B981', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#DCFCE7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F0FDF4'; }}
                >
                  <Eye size={13} />
                </button>
                {/* Edit */}
                <button
                  title="Editar"
                  onClick={() => setEditModal(u)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#FFFBEB', color: '#F59E0B', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF3C7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFBEB'; }}
                >
                  <Pencil size={13} />
                </button>
                {/* PIN */}
                <button
                  title="Cambiar PIN"
                  onClick={() => setPinModal(u)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#F0F9FF', color: '#0EA5E9', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E0F2FE'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F0F9FF'; }}
                >
                  <KeyRound size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
