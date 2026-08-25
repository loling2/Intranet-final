import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Search, Mail, CheckCircle2,
  CreditCard as Edit2, Key, X, Eye, EyeOff, AlertCircle,
  RefreshCw, Hash, UserCheck, Send, FileText, UserCog, Trash2, KeyRound,
  Building2,
} from 'lucide-react';
import { Pagination, paginate, totalPages as calcTotalPages } from './components/Pagination';
import { supabase, UserProfile, AppRole, Empleado } from './supabaseClient';
import { useAuth } from './context/AuthContext';
import { useSociety } from './context/SocietyContext';
import { writeAuditLog } from './lib/auditLog';

const ROLE_COLORS: Record<AppRole, { bg: string; text: string; border: string; label: string }> = {
  admin:          { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Admin' },
  rrhh:           { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'RRHH' },
  employee:       { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', label: 'Empleado' },
  prevencion:     { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'Prevencion' },
  supervisor:     { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', label: 'Supervisor' },
  administracion: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: 'Administracion' },
  formacion:      { bg: '#F0FDFA', text: '#0D9488', border: '#99F6E4', label: 'Formacion' },
  calidad:        { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD', label: 'Calidad' },
};

// ─── helpers ────────────────────────────────────────────────────────────────

async function callManageUser(action: string, userId: string, payload: Record<string, unknown>) {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action, userId, ...payload }),
    }
  );
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error ?? `Error ${resp.status}`);
  return body;
}

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateRandomPassword(length = 12): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = lower + upper + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pwd = [pick(upper), pick(lower), pick(digits), pick(symbols)].join('');
  for (let i = pwd.length; i < length; i++) pwd += pick(all);
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

// ─── Invite Modal ────────────────────────────────────────────────────────────

interface InviteModalProps { onClose: () => void; onInvited: () => void; currentUserRole: AppRole; }

function InviteModal({ onClose, onInvited, currentUserRole }: InviteModalProps) {
  const { profile } = useAuth();
  const { societies } = useSociety();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('employee');
  const [selectedSocieties, setSelectedSocieties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const availableRoles: AppRole[] = currentUserRole === 'admin'
    ? ['admin', 'rrhh', 'prevencion', 'supervisor', 'administracion', 'formacion', 'calidad', 'employee']
    : ['rrhh', 'prevencion', 'supervisor', 'administracion', 'formacion', 'calidad', 'employee'];

  const toggleSociety = (id: string) =>
    setSelectedSocieties((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const handleInvite = async () => {
    if (!nombre.trim() || !email.trim()) { setError('El nombre y el correo son obligatorios.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Introduce un correo electronico valido.'); return; }
    setLoading(true); setError('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/manage-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'create_user',
          email: email.trim().toLowerCase(),
          nombre: nombre.trim(),
          role,
          societies: selectedSocieties,
        }),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(result.error ?? `Error ${resp.status}`);

      if (profile) {
        await writeAuditLog({
          evento: 'user_invited',
          descripcion: `Usuario creado: ${email} con rol ${role}`,
          autor: profile,
          entidad: 'user',
          entidad_id: result.userId,
          metadata: { email, role, societies: selectedSocieties },
        });
      }
      setSuccess(true);
      setTimeout(() => { onInvited(); onClose(); }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-white" />
            <h2 className="text-white font-semibold">Invitar Nuevo Usuario</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={15} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {success ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: '#F0FDF4', border: '2px solid #22C55E' }}>
                <CheckCircle2 size={32} style={{ color: '#22C55E' }} />
              </div>
              <h3 className="font-semibold text-base" style={{ color: '#1E293B' }}>Usuario creado</h3>
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>El usuario ha sido creado. Puedes asignarle una contrasena desde Gestion de Usuarios.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nombre completo *</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Garcia"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Correo electronico *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Rol</label>
                <div className="flex gap-2 flex-wrap">
                  {availableRoles.map((r) => {
                    const rc = ROLE_COLORS[r];
                    return (
                      <button key={r} onClick={() => setRole(r)} className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer min-w-[70px]"
                        style={{ backgroundColor: role === r ? rc.bg : 'transparent', color: role === r ? rc.text : '#94A3B8', borderColor: role === r ? rc.border : '#E2E8F0' }}>
                        {rc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Sociedades asignadas</label>
                <div className="grid grid-cols-2 gap-2">
                  {societies.map((s) => {
                    const isSelected = selectedSocieties.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => toggleSociety(s.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer text-left"
                        style={{ backgroundColor: isSelected ? s.primaryLight : 'transparent', color: isSelected ? s.primary : '#64748B', borderColor: isSelected ? s.border : '#E2E8F0' }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center font-bold"
                          style={{ backgroundColor: isSelected ? `${s.primary}20` : '#F1F5F9', color: isSelected ? s.primary : '#94A3B8', fontSize: '10px' }}>
                          {s.logoLetter}
                        </div>
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <AlertCircle size={14} style={{ color: '#DC2626' }} /> <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleInvite} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#0F172A' }}>
                  {loading ? <><RefreshCw size={14} className="animate-spin" /> Creando...</> : <><UserPlus size={14} /> Crear Usuario</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit User Modal ─────────────────────────────────────────────────────────

type ActiveField = 'email' | 'password' | 'pin' | null;

interface EditUserModalProps { user: UserProfile; onClose: () => void; onSaved: () => void; currentUserRole: AppRole; }

function EditUserModal({ user, onClose, onSaved, currentUserRole }: EditUserModalProps) {
  const { profile } = useAuth();
  const [activeField, setActiveField] = useState<ActiveField>(null);

  // credential fields
  const [email, setEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pin, setPin] = useState('');
  const [currentPin] = useState<string | null>(user.pin ?? null);

  // role / status / societies fields
  const { societies } = useSociety();
  const [role, setRole] = useState<AppRole>(user.role);
  const [activo, setActivo] = useState(user.activo);
  const [selectedSocieties, setSelectedSocieties] = useState<string[]>(user.societies ?? []);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaSuccess, setMetaSuccess] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fieldSuccess, setFieldSuccess] = useState<ActiveField>(null);
  const [error, setError] = useState('');

  // Supervisor assignment state
  const [supervisorEmpleados, setSupervisorEmpleados] = useState<Empleado[]>([]);
  const [allEmpleados, setAllEmpleados] = useState<Empleado[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [savingAsign, setSavingAsign] = useState(false);
  // Supervisor centros assignment state
  const [supervisorCentros, setSupervisorCentros] = useState<{ id: string; nombre: string }[]>([]);
  const [allCentros, setAllCentros] = useState<{ id: string; nombre: string }[]>([]);
  const [savingCentro, setSavingCentro] = useState(false);

  const loadSupervisorEmpleados = useCallback(async () => {
    if (user.role !== 'supervisor') return;
    try {
      const { data, error: err } = await supabase
        .from('supervisor_asignaciones')
        .select('empleado_id')
        .eq('supervisor_id', user.id);
      if (err) throw err;
      const ids = (data ?? []).map((r: { empleado_id: string }) => r.empleado_id);
      if (ids.length === 0) { setSupervisorEmpleados([]); return; }
      const { data: emps } = await supabase
        .from('empleados')
        .select('*')
        .in('id', ids)
        .order('nombre');
      setSupervisorEmpleados((emps ?? []) as Empleado[]);
    } catch { setSupervisorEmpleados([]); }
  }, [user.id, user.role]);

  const loadAllEmpleados = useCallback(async () => {
    if (user.role !== 'supervisor') return;
    try {
      const { data, error: err } = await supabase
        .from('empleados')
        .select('*')
        .order('nombre');
      if (err) throw err;
      setAllEmpleados((data ?? []) as Empleado[]);
    } catch { setAllEmpleados([]); }
  }, [user.role]);

  const loadSupervisorCentros = useCallback(async () => {
    if (user.role !== 'supervisor') return;
    try {
      const { data, error: err } = await supabase
        .from('supervisor_centros')
        .select('centro_id, centros(id, nombre)')
        .eq('supervisor_id', user.id);
      if (err) throw err;
      const list = ((data ?? []) as { centro_id: string; centros: { id: string; nombre: string } | null }[])
        .filter((r) => r.centros)
        .map((r) => ({ id: r.centros!.id, nombre: r.centros!.nombre }));
      setSupervisorCentros(list);
    } catch { setSupervisorCentros([]); }
  }, [user.id, user.role]);

  const loadAllCentros = useCallback(async () => {
    if (user.role !== 'supervisor') return;
    try {
      const { data, error: err } = await supabase
        .from('centros')
        .select('id, nombre')
        .order('nombre');
      if (err) throw err;
      setAllCentros((data ?? []) as { id: string; nombre: string }[]);
    } catch { setAllCentros([]); }
  }, [user.role]);

  useEffect(() => {
    if (user.role === 'supervisor') {
      loadSupervisorEmpleados();
      loadAllEmpleados();
      loadSupervisorCentros();
      loadAllCentros();
    }
  }, [user.role, loadSupervisorEmpleados, loadAllEmpleados, loadSupervisorCentros, loadAllCentros]);

  const handleAssignEmpleado = async (empId: string) => {
    setSavingAsign(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('supervisor_asignaciones')
        .insert({ supervisor_id: user.id, empleado_id: empId });
      if (err) throw err;
      await loadSupervisorEmpleados();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar');
    } finally { setSavingAsign(false); }
  };

  const handleUnassignEmpleado = async (empId: string) => {
    setSavingAsign(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('supervisor_asignaciones')
        .delete()
        .eq('supervisor_id', user.id)
        .eq('empleado_id', empId);
      if (err) throw err;
      await loadSupervisorEmpleados();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al desasignar');
    } finally { setSavingAsign(false); }
  };

  const handleAssignCentro = async (centroId: string) => {
    setSavingCentro(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('supervisor_centros')
        .insert({ supervisor_id: user.id, centro_id: centroId });
      if (err) throw err;
      await loadSupervisorCentros();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar centro');
    } finally { setSavingCentro(false); }
  };

  const handleUnassignCentro = async (centroId: string) => {
    setSavingCentro(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('supervisor_centros')
        .delete()
        .eq('supervisor_id', user.id)
        .eq('centro_id', centroId);
      if (err) throw err;
      await loadSupervisorCentros();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al desasignar centro');
    } finally { setSavingCentro(false); }
  };

  const open = (field: ActiveField) => {
    setActiveField(field);
    setError('');
    setFieldSuccess(null);
    setNewPassword('');
    setConfirmPassword('');
    setPin('');
    setEmail(user.email);
  };

  const close = () => { setActiveField(null); setError(''); };

  const handleSaveEmail = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Correo no valido.'); return; }
    if (trimmed === user.email.toLowerCase()) { setError('El correo es identico al actual.'); return; }
    setLoading(true); setError('');
    try {
      await callManageUser('set_email', user.id, { email: trimmed });
      if (profile) await writeAuditLog({ evento: 'email_changed', descripcion: `Correo de ${user.nombre} cambiado a ${trimmed}`, autor: profile, entidad: 'user', entidad_id: user.id, metadata: { from: user.email, to: trimmed } });
      setFieldSuccess('email');
      setActiveField(null);
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 8) { setError('Minimo 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('Las contrasenas no coinciden.'); return; }
    setLoading(true); setError('');
    try {
      await callManageUser('set_password', user.id, { password: newPassword });
      if (profile) await writeAuditLog({ evento: 'password_set', descripcion: `Contrasena establecida para ${user.email}`, autor: profile, entidad: 'user', entidad_id: user.id });
      setFieldSuccess('password');
      setActiveField(null);
      setNewPassword(''); setConfirmPassword('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  };

  const handleSetPin = async (value?: string) => {
    const v = value ?? pin;
    if (!v || v.length < 4) { setError('El PIN debe tener al menos 4 digitos.'); return; }
    setLoading(true); setError('');
    try {
      await callManageUser('set_pin', user.id, { pin: v });
      if (profile) await writeAuditLog({ evento: 'pin_set', descripcion: `PIN establecido para ${user.email}`, autor: profile, entidad: 'user', entidad_id: user.id });
      setFieldSuccess('pin');
      setActiveField(null);
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  };

  const handleGeneratePin = () => {
    const p = generatePin();
    setPin(p);
    handleSetPin(p);
  };

  const toggleSociety = (id: string) =>
    setSelectedSocieties((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const handleSaveMeta = async () => {
    setSavingMeta(true); setError('');
    try {
      const { error: err } = await supabase.from('user_profiles').update({ role, activo, societies: selectedSocieties }).eq('id', user.id);
      if (err) throw err;
      if (profile) await writeAuditLog({ evento: 'user_meta_changed', descripcion: `Perfil de ${user.nombre} actualizado: rol=${role}, activo=${activo}`, autor: profile, entidad: 'user', entidad_id: user.id });
      setMetaSuccess(true);
      setTimeout(() => setMetaSuccess(false), 2500);
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al guardar'); }
    finally { setSavingMeta(false); }
  };

  const societiesChanged = JSON.stringify([...selectedSocieties].sort()) !== JSON.stringify([...(user.societies ?? [])].sort());
  const metaDirty = role !== user.role || activo !== user.activo || societiesChanged;

  const availableRoles: AppRole[] = currentUserRole === 'admin'
    ? ['admin', 'rrhh', 'prevencion', 'supervisor', 'administracion', 'formacion', 'calidad', 'employee']
    : ['rrhh', 'prevencion', 'supervisor', 'administracion', 'formacion', 'calidad', 'employee'];

  const rc = ROLE_COLORS[user.role];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-y-auto shadow-2xl" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">{user.nombre}</h2>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: rc.bg, color: rc.text }}>{rc.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-3">

          {/* ── Rol y Estado ── */}
          <div className="rounded-xl p-4 space-y-4" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Rol y Estado</p>

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Rol de acceso</p>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((r) => {
                  const rCol = ROLE_COLORS[r];
                  const isActive = role === r;
                  return (
                    <button key={r} onClick={() => setRole(r)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer"
                      style={{
                        backgroundColor: isActive ? rCol.bg : 'transparent',
                        color: isActive ? rCol.text : '#94A3B8',
                        borderColor: isActive ? rCol.border : '#E2E8F0',
                      }}>
                      {rCol.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Estado de la cuenta</p>
              <div className="flex gap-2">
                <button onClick={() => setActivo(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer"
                  style={{ backgroundColor: activo ? '#F0FDF4' : 'transparent', color: activo ? '#16A34A' : '#94A3B8', borderColor: activo ? '#BBF7D0' : '#E2E8F0' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activo ? '#22C55E' : '#CBD5E1' }} />
                  Activo
                </button>
                <button onClick={() => setActivo(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer"
                  style={{ backgroundColor: !activo ? '#FEF2F2' : 'transparent', color: !activo ? '#DC2626' : '#94A3B8', borderColor: !activo ? '#FECACA' : '#E2E8F0' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: !activo ? '#EF4444' : '#CBD5E1' }} />
                  Inactivo
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Sociedades asignadas</p>
              {societies.length === 0 ? (
                <p className="text-xs" style={{ color: '#CBD5E1' }}>No hay sociedades disponibles</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {societies.map((s) => {
                    const sel = selectedSocieties.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => toggleSociety(s.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer text-left"
                        style={{
                          backgroundColor: sel ? s.primaryLight : 'transparent',
                          color: sel ? s.primary : '#64748B',
                          borderColor: sel ? s.border : '#E2E8F0',
                        }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center font-bold flex-shrink-0"
                          style={{
                            backgroundColor: sel ? `${s.primary}20` : '#F1F5F9',
                            color: sel ? s.primary : '#94A3B8',
                            fontSize: '10px',
                          }}>
                          {s.logoLetter}
                        </div>
                        <span className="truncate">{s.name}</span>
                        {sel && <CheckCircle2 size={12} className="ml-auto flex-shrink-0" style={{ color: s.primary }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {error && !activeField && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}

            <button
              onClick={handleSaveMeta}
              disabled={savingMeta || !metaDirty}
              className="w-full py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all duration-150"
              style={{ backgroundColor: metaSuccess ? '#16A34A' : '#0F172A' }}
            >
              {savingMeta ? <RefreshCw size={12} className="animate-spin" /> : metaSuccess ? <CheckCircle2 size={12} /> : null}
              {metaSuccess ? 'Guardado' : 'Guardar cambios'}
            </button>
          </div>

          {/* ── Correo ── */}
          <CredentialRow
            icon={<Mail size={15} />}
            label="Correo electronico"
            value={user.email}
            isOpen={activeField === 'email'}
            succeeded={fieldSuccess === 'email'}
            onToggle={() => activeField === 'email' ? close() : open('email')}
            accentColor="#2563EB"
            accentBg="#EFF6FF"
            accentBorder="#BFDBFE"
          >
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1.5px solid #BFDBFE', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              </div>
              {error && activeField === 'email' && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleSaveEmail} disabled={loading}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: '#2563EB' }}>
                  {loading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Guardar
                </button>
              </div>
            </div>
          </CredentialRow>

          {/* ── Contrasena ── */}
          <CredentialRow
            icon={<Key size={15} />}
            label="Contrasena de acceso"
            value="••••••••"
            isOpen={activeField === 'password'}
            succeeded={fieldSuccess === 'password'}
            onToggle={() => activeField === 'password' ? close() : open('password')}
            accentColor="#0369A1"
            accentBg="#EFF6FF"
            accentBorder="#BFDBFE"
          >
            <div className="mt-3 space-y-2">
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                  placeholder="Nueva contrasena (min. 8 caracteres)"
                  autoFocus
                  className="w-full pl-3 pr-9 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1.5px solid #BFDBFE', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input type={showPw ? 'text' : 'password'} value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Repetir contrasena"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1.5px solid ${confirmPassword && newPassword !== confirmPassword ? '#EF4444' : '#BFDBFE'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs" style={{ color: '#DC2626' }}>Las contrasenas no coinciden</p>
              )}
              {error && activeField === 'password' && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleSetPassword}
                  disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: '#0369A1' }}>
                  {loading ? <RefreshCw size={12} className="animate-spin" /> : <Key size={12} />} Establecer
                </button>
              </div>
            </div>
          </CredentialRow>

          {/* ── PIN Fichaje ── */}
          <CredentialRow
            icon={<Hash size={15} />}
            label="PIN de fichaje"
            value={currentPin ? `${currentPin.slice(0, 2)}${'•'.repeat(currentPin.length - 2)}` : 'Sin PIN asignado'}
            isOpen={activeField === 'pin'}
            succeeded={fieldSuccess === 'pin'}
            onToggle={() => activeField === 'pin' ? close() : open('pin')}
            accentColor="#16A34A"
            accentBg="#F0FDF4"
            accentBorder="#BBF7D0"
          >
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input type="text" inputMode="numeric" maxLength={6} value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="4–6 digitos"
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none font-mono tracking-widest text-center"
                  style={{ border: '1.5px solid #BBF7D0', color: '#1E293B', backgroundColor: '#F8FAFC', letterSpacing: '0.3em' }} />
                <button onClick={() => handleSetPin()} disabled={loading || pin.length < 4}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  style={{ backgroundColor: '#16A34A' }}>
                  {loading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Guardar
                </button>
              </div>
              <button onClick={handleGeneratePin} disabled={loading}
                className="w-full py-2 rounded-lg text-xs font-medium border cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5 transition-all duration-150 hover:bg-green-50"
                style={{ borderColor: '#BBF7D0', color: '#16A34A', backgroundColor: 'transparent' }}>
                <RefreshCw size={11} /> Generar automaticamente
              </button>
              {error && activeField === 'pin' && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <button onClick={close} className="w-full py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: '#94A3B8' }}>Cancelar</button>
            </div>
          </CredentialRow>
        </div>

        {/* ── Supervisor: empleados asignados ── */}
        {user.role === 'supervisor' && (
          <div className="px-5 pb-5">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #DDD6FE', backgroundColor: '#FAFAFF' }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #EDE9FE' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
                  <UserCog size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7C3AED' }}>Empleados asignados a este supervisor</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: '#1E293B' }}>
                    {supervisorEmpleados.length} empleado{supervisorEmpleados.length !== 1 ? 's' : ''} asignado{supervisorEmpleados.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* List of assigned employees */}
              <div className="px-4 py-3 space-y-2">
                {supervisorEmpleados.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>No hay empleados asignados</p>
                )}
                {supervisorEmpleados.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                      style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>
                        {emp.nombre}{emp.apellidos ? ` ${emp.apellidos}` : ''}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                        {emp.puesto || 'Sin puesto'}{emp.centro_trabajo ? ` · ${emp.centro_trabajo}` : ''}
                      </p>
                    </div>
                    <button onClick={() => handleUnassignEmpleado(emp.id)} disabled={savingAsign}
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 disabled:opacity-50"
                      style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
                      title="Desasignar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add employee to supervisor */}
              <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid #EDE9FE' }}>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#7C3AED' }}>Asignar nuevo empleado</label>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input type="text" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Buscar empleado por nombre o DNI..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid #DDD6FE', color: '#1E293B', backgroundColor: '#FFFFFF' }} />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg" style={{ border: '1px solid #E2E8F0' }}>
                  {allEmpleados
                    .filter((emp) => {
                      const assigned = supervisorEmpleados.some((se) => se.id === emp.id);
                      if (assigned) return false;
                      if (!empSearch.trim()) return true;
                      const q = empSearch.toLowerCase();
                      return (emp.nombre + ' ' + (emp.apellidos ?? '')).toLowerCase().includes(q) ||
                        (emp.dni ?? '').toLowerCase().includes(q);
                    })
                    .slice(0, 30)
                    .map((emp) => (
                      <div key={emp.id} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>
                            {emp.nombre}{emp.apellidos ? ` ${emp.apellidos}` : ''}
                          </p>
                          <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                            {emp.puesto || 'Sin puesto'}{emp.centro_trabajo ? ` · ${emp.centro_trabajo}` : ''}
                          </p>
                        </div>
                        <button onClick={() => handleAssignEmpleado(emp.id)} disabled={savingAsign}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 disabled:opacity-50"
                          style={{ backgroundColor: '#7C3AED', color: '#FFFFFF' }}>
                          + Asignar
                        </button>
                      </div>
                    ))}
                </div>
                {error && <p className="text-xs mt-2" style={{ color: '#DC2626' }}>{error}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Supervisor: centros asignados ── */}
        {user.role === 'supervisor' && (
          <div className="px-5 pb-5">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #BFDBFE', backgroundColor: '#F8FAFF' }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #DBEAFE' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                  <Building2 size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#2563EB' }}>Centros asignados a este supervisor</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: '#1E293B' }}>
                    {supervisorCentros.length} centro{supervisorCentros.length !== 1 ? 's' : ''} asignado{supervisorCentros.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* List of assigned centros */}
              <div className="px-4 py-3 space-y-2">
                {supervisorCentros.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>No hay centros asignados. Los empleados de los centros asignados se verán automáticamente.</p>
                )}
                {supervisorCentros.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                      <Building2 size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{c.nombre}</p>
                    </div>
                    <button onClick={() => handleUnassignCentro(c.id)} disabled={savingCentro}
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 disabled:opacity-50"
                      style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
                      title="Desasignar centro">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add centro to supervisor */}
              <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid #DBEAFE' }}>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#2563EB' }}>Asignar nuevo centro</label>
                <div className="max-h-32 overflow-y-auto rounded-lg" style={{ border: '1px solid #E2E8F0' }}>
                  {allCentros
                    .filter((c) => !supervisorCentros.some((sc) => sc.id === c.id))
                    .map((c) => (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{c.nombre}</p>
                        </div>
                        <button onClick={() => handleAssignCentro(c.id)} disabled={savingCentro}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 disabled:opacity-50"
                          style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}>
                          + Asignar
                        </button>
                      </div>
                    ))}
                  {allCentros.filter((c) => !supervisorCentros.some((sc) => sc.id === c.id)).length === 0 && (
                    <p className="text-xs text-center py-3" style={{ color: '#94A3B8' }}>Todos los centros ya están asignados</p>
                  )}
                </div>
                {error && <p className="text-xs mt-2" style={{ color: '#DC2626' }}>{error}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer"
            style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Credential Row ───────────────────────────────────────────────────────────

function CredentialRow({
  icon, label, value, isOpen, succeeded, onToggle, accentColor, accentBg, accentBorder, children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isOpen: boolean;
  succeeded: boolean;
  onToggle: () => void;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ border: `1px solid ${isOpen ? accentBorder : '#E2E8F0'}`, backgroundColor: isOpen ? accentBg : '#FAFAFA' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isOpen ? `${accentColor}15` : '#F1F5F9', color: isOpen ? accentColor : '#94A3B8' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{label}</p>
          <p className="text-sm font-medium truncate mt-0.5" style={{ color: isOpen ? accentColor : '#1E293B' }}>{value}</p>
        </div>
        {succeeded && !isOpen && (
          <CheckCircle2 size={16} style={{ color: '#22C55E', flexShrink: 0 }} />
        )}
        <button onClick={onToggle}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
          style={{
            backgroundColor: isOpen ? accentColor : '#F1F5F9',
            color: isOpen ? '#FFFFFF' : '#475569',
          }}>
          {isOpen ? 'Cancelar' : 'Cambiar'}
        </button>
      </div>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Bulk Create Access Modal ────────────────────────────────────────────────

interface BulkCreateAccessModalProps {
  employees: Empleado[];
  onClose: () => void;
  onCreated: () => void;
}

function BulkCreateAccessModal({ employees, onClose, onCreated }: BulkCreateAccessModalProps) {
  const { profile } = useAuth();
  const [role, setRole] = useState<AppRole>('employee');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ id: string; nombre: string; ok: boolean; error?: string }[]>([]);
  const [done, setDone] = useState(false);

  const withEmail = employees.filter((e) => e.email?.trim());
  const withoutEmail = employees.filter((e) => !e.email?.trim());

  const handleCreate = async () => {
    setLoading(true);
    const created: typeof results = [];
    for (const emp of withEmail) {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'create_user',
            email: (emp.email ?? '').trim().toLowerCase(),
            nombre: emp.nombre,
            role,
            societies: emp.id_sociedad ? [emp.id_sociedad] : [],
          }),
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(result.error ?? `Error ${resp.status}`);
        if (profile) {
          await writeAuditLog({
            evento: 'user_invited',
            descripcion: `Acceso web creado para empleado: ${emp.email} con rol ${role}`,
            autor: profile,
            entidad: 'user',
            entidad_id: result.userId,
            metadata: { email: emp.email, role, empleado_id: emp.id },
          });
        }
        created.push({ id: emp.id, nombre: emp.nombre, ok: true });
      } catch (err) {
        created.push({ id: emp.id, nombre: emp.nombre, ok: false, error: err instanceof Error ? err.message : 'Error' });
      }
    }
    setResults(created);
    setDone(true);
    setLoading(false);
  };

  const successCount = results.filter((r) => r.ok).length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl" style={{ maxHeight: '92vh' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #065F46, #047857)' }}>
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-white" />
            <h2 className="text-white font-semibold">Crear acceso web</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 72px)' }}>
          {!done ? (
            <>
              <p className="text-sm" style={{ color: '#475569' }}>
                Se creará acceso web para <strong>{withEmail.length}</strong> empleado{withEmail.length !== 1 ? 's' : ''}.
              </p>

              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#64748B' }}>Rol asignado</label>
                <div className="flex gap-2 flex-wrap">
                  {(['employee', 'rrhh', 'prevencion', 'supervisor', 'administracion', 'formacion', 'calidad'] as AppRole[]).map((r) => {
                    const rc = ROLE_COLORS[r];
                    return (
                      <button key={r} onClick={() => setRole(r)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer min-w-[70px]"
                        style={{ backgroundColor: role === r ? rc.bg : 'transparent', color: role === r ? rc.text : '#94A3B8', borderColor: role === r ? rc.border : '#E2E8F0' }}>
                        {rc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: '#F8FAFC', color: '#94A3B8' }}>
                  Empleados seleccionados ({employees.length})
                </div>
                <div className="divide-y overflow-y-auto" style={{ borderColor: '#F1F5F9', maxHeight: '200px' }}>
                  {employees.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                        style={{ backgroundColor: emp.email ? '#F0FDF4' : '#FEF2F2', color: emp.email ? '#16A34A' : '#DC2626' }}>
                        {emp.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                        <p className="text-xs truncate" style={{ color: emp.email ? '#94A3B8' : '#EF4444' }}>
                          {emp.email || 'Sin correo — no se puede crear acceso'}
                        </p>
                      </div>
                      {!emp.email && <AlertCircle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
              </div>

              {withoutEmail.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <AlertCircle size={14} style={{ color: '#D97706', marginTop: '1px', flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: '#D97706' }}>
                    {withoutEmail.length} empleado{withoutEmail.length !== 1 ? 's' : ''} sin correo no recibirán acceso.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleCreate} disabled={loading || withEmail.length === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#065F46' }}>
                  {loading ? <><RefreshCw size={14} className="animate-spin" /> Creando...</> : <><UserCheck size={14} /> Crear acceso</>}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: successCount === withEmail.length ? '#F0FDF4' : '#FFFBEB', border: `2px solid ${successCount === withEmail.length ? '#22C55E' : '#F59E0B'}` }}>
                  <CheckCircle2 size={32} style={{ color: successCount === withEmail.length ? '#22C55E' : '#F59E0B' }} />
                </div>
                <h3 className="font-semibold text-base" style={{ color: '#1E293B' }}>
                  {successCount} de {withEmail.length} accesos creados
                </h3>
                <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                  Puedes asignar contrasenas desde la seccion de usuarios.
                </p>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="divide-y overflow-y-auto" style={{ borderColor: '#F1F5F9', maxHeight: '200px' }}>
                  {results.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: r.ok ? '#F0FDF4' : '#FEF2F2' }}>
                        {r.ok
                          ? <CheckCircle2 size={12} style={{ color: '#22C55E' }} />
                          : <X size={12} style={{ color: '#DC2626' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{r.nombre}</p>
                        {!r.ok && <p className="text-xs" style={{ color: '#DC2626' }}>{r.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { onCreated(); onClose(); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: '#065F46' }}>
                Cerrar y actualizar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Send Email Modal ────────────────────────────────────────────────────────

interface SendEmailModalProps {
  user: UserProfile;
  onClose: () => void;
}

interface EmailPlantilla { id: string; nombre: string; asunto: string; activo: boolean; }
interface EmailCuenta   { id: string; nombre: string; email: string; activo: boolean; }

function SendEmailModal({ user, onClose }: SendEmailModalProps) {
  const [plantillas, setPlantillas] = useState<EmailPlantilla[]>([]);
  const [cuentas, setCuentas]       = useState<EmailCuenta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [plantillaId, setPlantillaId] = useState('');
  const [cuentaId, setCuentaId]     = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [password, setPassword]     = useState('');
  const [empresa, setEmpresa]       = useState('');
  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState('');
  const [done, setDone]             = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('email_plantillas').select('id, nombre, asunto, activo').eq('activo', true).order('nombre'),
      supabase.from('email_cuentas').select('id, nombre, email, activo').eq('activo', true).order('nombre'),
    ]).then(([{ data: p }, { data: c }]) => {
      setPlantillas((p ?? []) as EmailPlantilla[]);
      setCuentas((c ?? []) as EmailCuenta[]);
      setLoading(false);
    });
  }, []);

  const handleSend = async () => {
    if (!plantillaId) { setError('Selecciona una plantilla'); return; }
    if (!cuentaId)    { setError('Selecciona una cuenta SMTP'); return; }
    setSending(true); setError('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token   = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

      let finalPassword = password;

      // Auto-generate a random password
      if (autoPassword) {
        finalPassword = generateRandomPassword();
      }

      // Send the email FIRST (before changing the password, which could
      // invalidate the current session if the admin is sending to themselves)
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            plantilla_id: plantillaId,
            cuenta_id: cuentaId,
            to_email: user.email,
            variables: {
              nombre:     user.nombre,
              email:      user.email,
              password:   finalPassword || '(ver con tu administrador)',
              url_acceso: window.location.origin,
              empresa:    empresa || 'la empresa',
            },
          }),
        }
      );
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error ?? `Error ${resp.status}`);

      // Now set the password on the user's account (after email is sent)
      if (autoPassword || password) {
        const pwdResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ action: 'set_password', userId: user.id, password: finalPassword }),
          }
        );
        const pwdBody = await pwdResp.json().catch(() => ({}));
        if (!pwdResp.ok) throw new Error(pwdBody.error ?? 'Error al asignar la contrasena');
      }

      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar el correo');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <Send size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Enviar correo de acceso</h2>
              <p className="text-white/60 text-xs truncate max-w-[220px]">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="flex flex-col items-center py-4 text-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ECFDF5', border: '2px solid #6EE7B7' }}>
                <CheckCircle2 size={28} style={{ color: '#065F46' }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: '#065F46' }}>Correo enviado correctamente</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>El correo ha sido enviado a {user.email}</p>
              <button onClick={onClose} className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                Cerrar
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Plantilla *</label>
                {plantillas.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <FileText size={13} />
                    No hay plantillas activas. Crealas en Email → Plantillas.
                  </div>
                ) : (
                  <select value={plantillaId} onChange={(e) => { setPlantillaId(e.target.value); setError(''); }}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                    style={{ border: `1.5px solid ${!plantillaId && error ? '#FECACA' : '#E2E8F0'}`, backgroundColor: '#F8FAFC', color: plantillaId ? '#1E293B' : '#94A3B8' }}>
                    <option value="">Selecciona una plantilla...</option>
                    {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Cuenta SMTP emisora *</label>
                {cuentas.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <Mail size={13} />
                    No hay cuentas SMTP activas. Configuralas en Email → Cuentas SMTP.
                  </div>
                ) : (
                  <select value={cuentaId} onChange={(e) => { setCuentaId(e.target.value); setError(''); }}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                    style={{ border: `1.5px solid ${!cuentaId && error ? '#FECACA' : '#E2E8F0'}`, backgroundColor: '#F8FAFC', color: cuentaId ? '#1E293B' : '#94A3B8' }}>
                    <option value="">Selecciona una cuenta...</option>
                    {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-semibold mb-1.5 uppercase tracking-wider cursor-pointer" style={{ color: '#64748B' }}>
                  <input
                    type="checkbox"
                    checked={autoPassword}
                    onChange={(e) => setAutoPassword(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: '#0369A1' }}
                  />
                  Generar contrasena aleatoria automaticamente
                </label>
                {autoPassword ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0369A1' }}>
                    <KeyRound size={13} />
                    Se generara una contrasena aleatoria y se asignara al usuario al enviar el correo.
                  </div>
                ) : (
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contrasena temporal del usuario"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Nombre de empresa <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(variable {`{{empresa}}`})</span>
                </label>
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Nombre de la empresa"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <AlertCircle size={13} style={{ color: '#DC2626' }} />
                  <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !plantillaId || !cuentaId}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#0F172A' }}
                >
                  {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  Enviar correo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props { currentUserRole: AppRole; onImpersonate?: (userId: string, societyId: string | null) => void; }

export default function UserManagement({ currentUserRole, onImpersonate }: Props) {
  const { societies } = useSociety();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [sendEmailUser, setSendEmailUser] = useState<UserProfile | null>(null);
  const [page, setPage] = useState(1);
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const [profilesRes, empRes] = await Promise.all([
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('empleados').select('id, nombre, email, user_id, id_sociedad, puesto, activo').order('nombre'),
    ]);
    setUsers((profilesRes.data ?? []) as UserProfile[]);
    setEmpleados((empRes.data ?? []) as Empleado[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { setPage(1); }, [search, filterRole, filterStatus]);

  const userIds = new Set(users.map((u) => u.id));
  // Empleados that don't have a linked user_profiles entry
  const empleadosSinCuenta = empleados.filter((e) => !e.user_id || !userIds.has(e.user_id));

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.nombre.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = filterStatus === '' ? true : filterStatus === 'activo' ? u.activo : !u.activo;
    return matchSearch && matchRole && matchStatus;
  });

  const filteredEmpleados = empleadosSinCuenta.filter((e) => {
    if (filterRole && filterRole !== 'employee') return false;
    if (filterStatus === 'inactivo' && e.activo) return false;
    if (filterStatus === 'activo' && !e.activo) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.nombre.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q);
  });

  const PAGE_SIZE = 25;
  const allRows = [...filtered.map(u => ({ type: 'user' as const, data: u })), ...filteredEmpleados.map(e => ({ type: 'emp' as const, data: e }))];
  const tp = calcTotalPages(allRows.length, PAGE_SIZE);
  const safePage = Math.min(page, tp);
  const pageRows = paginate(allRows, safePage, PAGE_SIZE);
  const pageUsers = pageRows.filter(r => r.type === 'user').map(r => r.data as UserProfile);
  const pageEmps = pageRows.filter(r => r.type === 'emp').map(r => r.data as Empleado);
  const totalVisible = allRows.length;

  const toggleEmpSelection = (id: string) =>
    setSelectedEmps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAllPage = () => {
    const ids = pageEmps.map((e) => e.id);
    const allSel = ids.length > 0 && ids.every((id) => selectedEmps.has(id));
    setSelectedEmps((prev) => {
      const next = new Set(prev);
      if (allSel) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={loadUsers} currentUserRole={currentUserRole} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={loadUsers} currentUserRole={currentUserRole} />}
      {sendEmailUser && <SendEmailModal user={sendEmailUser} onClose={() => setSendEmailUser(null)} />}
      {showBulkModal && (
        <BulkCreateAccessModal
          employees={filteredEmpleados.filter((e) => selectedEmps.has(e.id))}
          onClose={() => setShowBulkModal(false)}
          onCreated={() => { setSelectedEmps(new Set()); loadUsers(); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Gestion de Usuarios</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{users.length} usuarios registrados · {empleadosSinCuenta.length} empleados sin acceso</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: '#0F172A', boxShadow: '0 4px 12px rgba(15,23,42,0.3)' }}>
          <UserPlus size={15} /> Nuevo Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input type="text" placeholder="Buscar por nombre o correo..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }} />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
          <option value="">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="rrhh">RRHH</option>
          <option value="prevencion">Prevencion</option>
          <option value="supervisor">Supervisor</option>
          <option value="administracion">Administracion</option>
          <option value="formacion">Formacion</option>
          <option value="employee">Empleado</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : totalVisible === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Users size={32} style={{ color: '#E2E8F0' }} />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>No se encontraron usuarios</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            <div className="px-6 py-3 hidden sm:grid grid-cols-12 gap-4" style={{ backgroundColor: '#F8FAFC' }}>
              <div className="col-span-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Usuario</div>
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Rol</div>
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Sociedades</div>
              <div className="col-span-1 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>PIN</div>
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Estado</div>
              <div className="col-span-1 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Acc.</div>
            </div>

            {/* Users with accounts */}
            {pageUsers.map((u) => {
              const rc = ROLE_COLORS[u.role];
              const userSocieties = (u.societies ?? []).map((sid) => societies.find((s) => s.id === sid)).filter(Boolean);
              return (
                <div key={u.id} className="px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors duration-150">
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{u.nombre}</p>
                      <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{u.email}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>
                      {rc.label}
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-1">
                    {userSocieties.length === 0
                      ? <span className="text-xs" style={{ color: '#94A3B8' }}>Todas</span>
                      : userSocieties.slice(0, 3).map((s) => s && (
                        <span key={s.id} className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: s.primaryLight, color: s.primary }}>{s.logoLetter}</span>
                      ))}
                  </div>
                  <div className="sm:col-span-1">
                    {u.pin
                      ? <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>{u.pin}</span>
                      : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.activo ? '#22C55E' : '#EF4444' }} />
                      <span className="text-xs" style={{ color: u.activo ? '#16A34A' : '#DC2626' }}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </div>
                  <div className="sm:col-span-1 flex items-center gap-1">
                    {onImpersonate && (
                      <button
                        onClick={() => onImpersonate(u.id, u.societies?.[0] ?? null)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-blue-50"
                        title="Ver como este usuario"
                      >
                        <Eye size={13} style={{ color: '#3B82F6' }} />
                      </button>
                    )}
                    <button onClick={() => setSendEmailUser(u)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-sky-50" title="Enviar correo de acceso">
                      <Send size={13} style={{ color: '#0EA5E9' }} />
                    </button>
                    <button onClick={() => setEditingUser(u)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-slate-100" title="Editar usuario">
                      <Edit2 size={13} style={{ color: '#64748B' }} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Employees without accounts */}
            {pageEmps.length > 0 && (
              <>
                <div className="px-6 py-2 flex items-center gap-3 justify-between" style={{ backgroundColor: '#FFFBEB', borderTop: '1px solid #FDE68A' }}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={pageEmps.length > 0 && pageEmps.every((e) => selectedEmps.has(e.id))}
                      onChange={toggleSelectAllPage}
                      className="w-4 h-4 cursor-pointer rounded"
                      style={{ accentColor: '#065F46' }}
                    />
                    <UserCheck size={13} style={{ color: '#D97706' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D97706' }}>
                      Empleados sin cuenta de acceso ({filteredEmpleados.length})
                    </span>
                  </div>
                  {selectedEmps.size > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#D97706' }}>
                      {selectedEmps.size} sel.
                    </span>
                  )}
                </div>
                {pageEmps.map((e) => (
                  <div key={e.id} className="px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center hover:bg-amber-50 transition-colors duration-150" style={{ opacity: 0.85 }}>
                    <div className="sm:col-span-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px dashed #FDE68A' }}>
                        {e.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{e.nombre}</p>
                        <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{e.email || '—'}</p>
                        {e.puesto && <p className="text-xs" style={{ color: '#CBD5E1' }}>{e.puesto}</p>}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px dashed #FDE68A' }}>
                        Sin acceso
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
                    </div>
                    <div className="sm:col-span-1">
                      <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.activo ? '#22C55E' : '#EF4444' }} />
                        <span className="text-xs" style={{ color: e.activo ? '#16A34A' : '#DC2626' }}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedEmps.has(e.id)}
                        onChange={() => toggleEmpSelection(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        className="w-4 h-4 cursor-pointer rounded"
                        style={{ accentColor: '#065F46' }}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {selectedEmps.size > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
              <span className="text-xs font-medium" style={{ color: '#16A34A' }}>
                {selectedEmps.size} empleado{selectedEmps.size !== 1 ? 's' : ''} seleccionado{selectedEmps.size !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedEmps(new Set())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:bg-green-100"
                style={{ color: '#16A34A', border: '1px solid #BBF7D0' }}>
                Deseleccionar
              </button>
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: '#065F46' }}>
                <UserCheck size={12} /> Crear acceso web
              </button>
            </div>
          </div>
        )}
        <Pagination page={safePage} totalPages={tp} totalItems={totalVisible} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
    </div>
  );
}
