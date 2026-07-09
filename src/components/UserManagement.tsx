import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, X, Loader2, Pencil, Search,
  AlertCircle, Eye, KeyRound, Mail, Shield,
  UserCheck, UserX, ChevronDown,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import PinChangeModal from './PinChangeModal';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  role: string;
  activo: boolean;
  societies: string[];
  pin: string | null;
  dni: string | null;
  created_at: string;
}

interface Sociedad {
  id: string;
  nombre: string;
}

interface Plantilla {
  id: string;
  nombre: string;
  asunto: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ROLES: Record<string, { label: string; color: string; bg: string }> = {
  admin:      { label: 'Admin',       color: '#7C3AED', bg: '#F5F3FF' },
  rrhh:       { label: 'RRHH',        color: '#2563EB', bg: '#EFF6FF' },
  prevencion: { label: 'Prevencion',  color: '#D97706', bg: '#FFFBEB' },
  employee:   { label: 'Empleado',    color: '#16A34A', bg: '#F0FDF4' },
};

// ─── Send Template Modal ────────────────────────────────────────────────────────

function SendTemplateModal({ userId, userName, userEmail, onClose }: {
  userId: string; userName: string; userEmail: string; onClose: () => void;
}) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from('email_plantillas').select('id, nombre, asunto').eq('activo', true)
      .then(({ data }) => {
        setPlantillas((data ?? []) as Plantilla[]);
        if (data?.[0]) setSelectedId(data[0].id);
      });
  }, []);

  const handleSend = async () => {
    if (!selectedId) { setError('Selecciona una plantilla'); return; }
    setSending(true); setError('');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-template-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ plantillaId: selectedId, destinatario: { id: userId, nombre: userName, email: userEmail } }),
    });
    setSending(false);
    if (!res.ok) { const e = await res.json(); setError(e.error ?? 'Error al enviar'); return; }
    setSuccess(true);
    setTimeout(onClose, 900);
  };

  const inp  = 'w-full px-3 py-2 rounded-lg text-sm outline-none';
  const inpS = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <Mail size={15} style={{ color: '#0EA5E9' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Enviar plantilla de correo</h2>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100">
            <X size={14} style={{ color: '#64748B' }} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
            <p className="font-medium text-sm" style={{ color: '#0284C7' }}>{userName}</p>
            <p className="text-xs mt-0.5" style={{ color: '#38BDF8' }}>{userEmail}</p>
          </div>
          {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}><AlertCircle size={12} /> {error}</div>}
          {success && <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Correo enviado correctamente</div>}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Plantilla de activación</label>
            {plantillas.length === 0
              ? <p className="text-xs" style={{ color: '#94A3B8' }}>No hay plantillas activas. Crea una en Email.</p>
              : <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inp} style={inpS}>
                  {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {p.asunto}</option>)}
                </select>
            }
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button onClick={handleSend} disabled={sending || success || plantillas.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: '#0EA5E9', color: '#fff' }}>
            {sending && <Loader2 size={13} className="animate-spin" />}
            {success ? 'Enviado' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Form Modal ────────────────────────────────────────────────────────────

function UserModal({ initial, sociedades, onClose, onSaved }: {
  initial: UserProfile | null; sociedades: Sociedad[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nombre:    initial?.nombre ?? '',
    email:     initial?.email  ?? '',
    role:      initial?.role   ?? 'employee',
    activo:    initial?.activo ?? true,
    societies: initial?.societies ?? [] as string[],
    dni:       initial?.dni ?? '',
  });
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const toggleSociedad = (id: string) =>
    set('societies', form.societies.includes(id) ? form.societies.filter((s) => s !== id) : [...form.societies, id]);

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.email.trim()) { setError('Nombre y email son obligatorios'); return; }
    setSaving(true); setError('');
    if (initial) {
      const { error: e } = await supabase.from('user_profiles')
        .update({ nombre: form.nombre, role: form.role, activo: form.activo, societies: form.societies, dni: form.dni || null, updated_at: new Date().toISOString() })
        .eq('id', initial.id);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'create', email: form.email, nombre: form.nombre, role: form.role, password, societies: form.societies }),
      });
      if (!res.ok) { const e = await res.json(); setError(e.error ?? 'Error al crear usuario'); setSaving(false); return; }
    }
    setSaving(false); onSaved(); onClose();
  };

  const inp  = 'w-full px-3 py-2 rounded-lg text-sm outline-none';
  const inpS = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' };
  const lbl  = 'block text-xs font-medium mb-1';
  const lblS = { color: '#64748B' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{initial ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"><X size={14} style={{ color: '#64748B' }} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}><AlertCircle size={12} /> {error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl} style={lblS}>Nombre completo *</label>
              <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Nombre Apellidos" className={inp} style={inpS} />
            </div>
            <div className="col-span-2">
              <label className={lbl} style={lblS}>Email *</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={!!initial} placeholder="usuario@empresa.com" className={inp} style={{ ...inpS, opacity: initial ? 0.6 : 1 }} />
            </div>
            {!initial && (
              <div className="col-span-2">
                <label className={lbl} style={lblS}>Contraseña inicial</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={inp} style={inpS} />
              </div>
            )}
            <div>
              <label className={lbl} style={lblS}>Rol</label>
              <select value={form.role} onChange={(e) => set('role', e.target.value)} className={inp} style={inpS}>
                {Object.entries(ROLES).map(([v, r]) => <option key={v} value={v}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl} style={lblS}>DNI / NIF</label>
              <input value={form.dni} onChange={(e) => set('dni', e.target.value)} placeholder="12345678A" className={inp} style={inpS} />
            </div>
            <div className="col-span-2">
              <label className={lbl} style={lblS}>Sociedades</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {sociedades.map((s) => {
                  const active = form.societies.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleSociedad(s.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{ border: `1.5px solid ${active ? '#0EA5E9' : '#E2E8F0'}`, backgroundColor: active ? '#F0F9FF' : '#F8FAFC', color: active ? '#0284C7' : '#64748B' }}>
                      {s.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="uactivo" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} className="w-4 h-4 rounded" />
              <label htmlFor="uactivo" className="text-sm" style={{ color: '#475569' }}>Usuario activo</label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#0F172A', color: '#fff' }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            {initial ? 'Guardar' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActivo, setFilterActivo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [pinUser, setPinUser] = useState<UserProfile | null>(null);
  const [sendUser, setSendUser] = useState<UserProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: u }, { data: s }] = await Promise.all([
      supabase.from('user_profiles').select('*').order('nombre'),
      supabase.from('sociedades').select('id, nombre').order('nombre'),
    ]);
    setUsers((u ?? []) as UserProfile[]);
    setSociedades((s ?? []) as Sociedad[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sinAcceso = users.filter((u) => u.role === 'employee' && !u.activo).length;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = !filterRole   || u.role === filterRole;
    const matchActivo = !filterActivo || (filterActivo === '1' ? u.activo : !u.activo);
    return matchSearch && matchRole && matchActivo;
  });

  const getSociedadLetra = (id: string) => {
    const s = sociedades.find((s) => s.id === id);
    return s ? s.nombre.charAt(0).toUpperCase() : '?';
  };

  // Distinct bg colors for society letters
  const SOC_COLORS = ['#DBEAFE', '#DCFCE7', '#FEF9C3', '#FCE7F3', '#EDE9FE'];
  const SOC_TEXT   = ['#1D4ED8', '#15803D', '#A16207', '#9D174D', '#6D28D9'];
  const socIndex = (id: string) => sociedades.findIndex((s) => s.id === id) % SOC_COLORS.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Gestion de Usuarios</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {users.length} usuarios registrados · {sinAcceso} empleados sin acceso
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
          <Users size={14} /> Nuevo Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[250px] relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }} />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569' }}>
          <option value="">Todos los roles</option>
          {Object.entries(ROLES).map(([v, r]) => <option key={v} value={v}>{r.label}</option>)}
        </select>
        <select value={filterActivo} onChange={(e) => setFilterActivo(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569' }}>
          <option value="">Todos los estados</option>
          <option value="1">Activos</option>
          <option value="0">Inactivos</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid #E2E8F0' }}>
        {/* Header row */}
        <div className="grid px-4 py-2.5 gap-4"
          style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', gridTemplateColumns: '1fr 130px 140px 80px 100px 100px' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Usuario</div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Rol</div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Sociedades</div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>PIN</div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Estado</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-right" style={{ color: '#94A3B8' }}>Acc.</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={22} className="animate-spin" style={{ color: '#0EA5E9' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>Sin resultados</p>
          </div>
        ) : (
          filtered.map((u) => {
            const roleInfo = ROLES[u.role] ?? ROLES.employee;
            const initial = u.nombre.charAt(0).toUpperCase();
            return (
              <div key={u.id}
                className="grid items-center px-4 py-3 gap-4 hover:bg-slate-50 transition-colors"
                style={{ borderBottom: '1px solid #F1F5F9', gridTemplateColumns: '1fr 130px 140px 80px 100px 100px' }}>

                {/* User */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                    style={{ backgroundColor: roleInfo.bg, color: roleInfo.color }}>
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{u.nombre}</p>
                    <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{u.email}</p>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: roleInfo.bg, color: roleInfo.color }}>
                    {roleInfo.label}
                  </span>
                </div>

                {/* Societies */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(u.societies ?? []).map((sid) => {
                    const idx = socIndex(sid);
                    return (
                      <div key={sid} title={sociedades.find((s) => s.id === sid)?.nombre ?? sid}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{ backgroundColor: SOC_COLORS[idx], color: SOC_TEXT[idx] }}>
                        {getSociedadLetra(sid)}
                      </div>
                    );
                  })}
                  {(!u.societies || u.societies.length === 0) && (
                    <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                  )}
                </div>

                {/* PIN */}
                <div>
                  {u.pin
                    ? <span className="text-xs font-mono px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>●●●●</span>
                    : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                  }
                </div>

                {/* Estado */}
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: u.activo ? '#22C55E' : '#94A3B8' }} />
                  <span className="text-xs font-medium" style={{ color: u.activo ? '#16A34A' : '#94A3B8' }}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 justify-end">
                  {/* View/edit */}
                  <button onClick={() => { setEditing(u); setShowModal(true); }}
                    title="Ver / Editar usuario"
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors">
                    <Eye size={13} style={{ color: '#0EA5E9' }} />
                  </button>
                  {/* Edit */}
                  <button onClick={() => { setEditing(u); setShowModal(true); }}
                    title="Editar"
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors">
                    <Pencil size={13} style={{ color: '#0EA5E9' }} />
                  </button>
                  {/* Send template email */}
                  <button onClick={() => setSendUser(u)}
                    title="Enviar plantilla de correo"
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-sky-50 transition-colors">
                    <Mail size={13} style={{ color: '#0EA5E9' }} />
                  </button>
                  {/* PIN */}
                  <button onClick={() => setPinUser(u)}
                    title={u.pin ? 'Cambiar PIN' : 'Asignar PIN'}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-violet-50 transition-colors">
                    <KeyRound size={13} style={{ color: u.pin ? '#7C3AED' : '#94A3B8' }} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <UserModal
          initial={editing}
          sociedades={sociedades}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
        />
      )}
      {pinUser && (
        <PinChangeModal
          userId={pinUser.id}
          userName={pinUser.nombre}
          currentPin={pinUser.pin}
          onClose={() => setPinUser(null)}
          onSaved={load}
        />
      )}
      {sendUser && (
        <SendTemplateModal
          userId={sendUser.id}
          userName={sendUser.nombre}
          userEmail={sendUser.email}
          onClose={() => setSendUser(null)}
        />
      )}
    </div>
  );
}
