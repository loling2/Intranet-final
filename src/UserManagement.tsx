import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Search, Mail, CheckCircle2, XCircle,
  CreditCard as Edit2, Key, X, Eye, EyeOff, AlertCircle,
  RefreshCw, Hash, Shield,
} from 'lucide-react';
import { supabase, UserProfile, AppRole } from './supabaseClient';
import { useAuth } from './context/AuthContext';
import { useSociety } from './context/SocietyContext';
import { writeAuditLog } from './lib/auditLog';

const ROLE_COLORS: Record<AppRole, { bg: string; text: string; border: string; label: string }> = {
  admin:     { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Admin' },
  rrhh:      { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'RRHH' },
  employee:  { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', label: 'Empleado' },
  prevencion:{ bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'Prevencion' },
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
    ? ['admin', 'rrhh', 'prevencion', 'employee']
    : ['rrhh', 'prevencion', 'employee'];

  const toggleSociety = (id: string) =>
    setSelectedSocieties((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const handleInvite = async () => {
    if (!nombre.trim() || !email.trim()) { setError('El nombre y el correo son obligatorios.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Introduce un correo electronico valido.'); return; }
    setLoading(true); setError('');
    try {
      const tempPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!';
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: tempPassword,
        options: { emailRedirectTo: `${window.location.origin}/?type=invite`, data: { nombre: nombre.trim() } },
      });
      if (signUpErr) throw signUpErr;
      if (!signUpData.user) throw new Error('No se pudo crear el usuario.');

      const { error: profileErr } = await supabase.from('user_profiles').insert({
        id: signUpData.user.id,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        role,
        activo: true,
        societies: selectedSocieties,
        invited_by: profile?.id ?? null,
      });
      if (profileErr) throw profileErr;

      if (profile) {
        await writeAuditLog({
          evento: 'user_invited',
          descripcion: `Usuario invitado: ${email} con rol ${role}`,
          autor: profile,
          entidad: 'user',
          entidad_id: signUpData.user.id,
          metadata: { email, role, societies: selectedSocieties },
        });
      }
      setSuccess(true);
      setTimeout(() => { onInvited(); onClose(); }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al invitar usuario');
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
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>Ahora puedes asignarle una contrasena desde Gestion de Usuarios.</p>
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

type EditTab = 'info' | 'password' | 'pin';

interface EditUserModalProps { user: UserProfile; onClose: () => void; onSaved: () => void; currentUserRole: AppRole; }

function EditUserModal({ user, onClose, onSaved, currentUserRole }: EditUserModalProps) {
  const { profile } = useAuth();
  const { societies } = useSociety();
  const [tab, setTab] = useState<EditTab>('info');

  // info tab
  const [nombre, setNombre] = useState(user.nombre);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<AppRole>(user.role);
  const [activo, setActivo] = useState(user.activo);
  const [selectedSocieties, setSelectedSocieties] = useState<string[]>(user.societies ?? []);

  // password tab
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // pin tab
  const [pin, setPin] = useState(user.pin ?? '');
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availableRoles: AppRole[] = currentUserRole === 'admin'
    ? ['admin', 'rrhh', 'prevencion', 'employee']
    : ['rrhh', 'prevencion', 'employee'];

  const toggleSociety = (id: string) =>
    setSelectedSocieties((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const clearFeedback = () => { setError(''); setSuccess(''); };

  const handleSaveInfo = async () => {
    setLoading(true); clearFeedback();
    try {
      // email changed → update via edge function
      if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
        await callManageUser('set_email', user.id, { email: email.trim().toLowerCase() });
      }
      // role changed → update via edge function
      if (role !== user.role) {
        await callManageUser('set_role', user.id, { role });
      }
      // update nombre / activo / societies directly (no auth changes needed)
      const { error: err } = await supabase
        .from('user_profiles')
        .update({ nombre, activo, societies: selectedSocieties })
        .eq('id', user.id);
      if (err) throw err;

      if (profile) {
        if (role !== user.role) {
          await writeAuditLog({ evento: 'user_role_changed', descripcion: `Rol de ${user.email} cambiado de ${user.role} a ${role}`, autor: profile, entidad: 'user', entidad_id: user.id, metadata: { from: user.role, to: role } });
        }
        if (activo !== user.activo) {
          await writeAuditLog({ evento: activo ? 'user_activated' : 'user_deactivated', descripcion: `Usuario ${user.email} ${activo ? 'activado' : 'desactivado'}`, autor: profile, entidad: 'user', entidad_id: user.id });
        }
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally { setLoading(false); }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 8) { setError('La contrasena debe tener al menos 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('Las contrasenas no coinciden.'); return; }
    setLoading(true); clearFeedback();
    try {
      await callManageUser('set_password', user.id, { password: newPassword });
      if (profile) {
        await writeAuditLog({ evento: 'password_set', descripcion: `Contrasena establecida para ${user.email}`, autor: profile, entidad: 'user', entidad_id: user.id });
      }
      setSuccess('Contrasena establecida correctamente.');
      setNewPassword(''); setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally { setLoading(false); }
  };

  const handleSetPin = async (pinValue?: string) => {
    const value = pinValue ?? pin;
    if (!value || value.length < 4) { setError('El PIN debe tener al menos 4 digitos.'); return; }
    setLoading(true); clearFeedback();
    try {
      await callManageUser('set_pin', user.id, { pin: value });
      if (profile) {
        await writeAuditLog({ evento: 'pin_set', descripcion: `PIN establecido para ${user.email}`, autor: profile, entidad: 'user', entidad_id: user.id });
      }
      setSuccess(`PIN ${value} guardado correctamente.`);
      setGeneratedPin(value);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally { setLoading(false); }
  };

  const handleGeneratePin = () => {
    const p = generatePin();
    setPin(p);
    setGeneratedPin(null);
    handleSetPin(p);
  };

  const tabs: { id: EditTab; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'Informacion', icon: <Edit2 size={13} /> },
    { id: 'password', label: 'Contrasena', icon: <Key size={13} /> },
    { id: 'pin', label: 'PIN', icon: <Hash size={13} /> },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div>
            <h2 className="text-white font-semibold">Editar Usuario</h2>
            <p className="text-white/60 text-xs">{user.email}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); clearFeedback(); }}
              className="flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200"
              style={{ color: tab === t.id ? '#0F172A' : '#94A3B8', borderBottom: tab === t.id ? '2px solid #0F172A' : '2px solid transparent' }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {/* INFO TAB */}
          {tab === 'info' && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nombre</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Correo electronico</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Rol</label>
                <div className="flex gap-2 flex-wrap">
                  {availableRoles.map((r) => {
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
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Estado</label>
                <div className="flex gap-2">
                  <button onClick={() => setActivo(true)} className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer"
                    style={{ backgroundColor: activo ? '#F0FDF4' : 'transparent', color: activo ? '#16A34A' : '#94A3B8', borderColor: activo ? '#BBF7D0' : '#E2E8F0' }}>Activo</button>
                  <button onClick={() => setActivo(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer"
                    style={{ backgroundColor: !activo ? '#FEF2F2' : 'transparent', color: !activo ? '#DC2626' : '#94A3B8', borderColor: !activo ? '#FECACA' : '#E2E8F0' }}>Inactivo</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Sociedades</label>
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
            </>
          )}

          {/* PASSWORD TAB */}
          {tab === 'password' && (
            <>
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <Key size={15} style={{ color: '#2563EB', flexShrink: 0, marginTop: 2 }} />
                <p className="text-xs" style={{ color: '#1D4ED8' }}>
                  Establece directamente una nueva contrasena para este usuario. Minimo 8 caracteres.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nueva contrasena</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimo 8 caracteres"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Confirmar contrasena</label>
                <input type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir contrasena"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs" style={{ color: '#DC2626' }}>Las contrasenas no coinciden</p>
              )}
            </>
          )}

          {/* PIN TAB */}
          {tab === 'pin' && (
            <>
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <Hash size={15} style={{ color: '#16A34A', flexShrink: 0, marginTop: 2 }} />
                <p className="text-xs" style={{ color: '#166534' }}>
                  El PIN se usara para el sistema de fichaje. Genera uno automaticamente o introduce uno manualmente (minimo 4 digitos).
                </p>
              </div>
              {user.pin && !generatedPin && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <span className="text-xs font-medium" style={{ color: '#64748B' }}>PIN actual:</span>
                  <span className="text-sm font-bold font-mono tracking-widest" style={{ color: '#0F172A' }}>{user.pin}</span>
                </div>
              )}
              {generatedPin && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #22C55E' }}>
                  <CheckCircle2 size={15} style={{ color: '#22C55E' }} />
                  <span className="text-xs font-medium" style={{ color: '#166534' }}>Nuevo PIN:</span>
                  <span className="text-lg font-bold font-mono tracking-widest" style={{ color: '#15803D' }}>{generatedPin}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>PIN manual</label>
                <div className="flex gap-2">
                  <input type="text" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setGeneratedPin(null); }}
                    placeholder="Ej: 4821"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none font-mono tracking-widest" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
                  <button onClick={() => handleSetPin()} disabled={loading || pin.length < 4}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                    style={{ backgroundColor: '#0F172A' }}>
                    <Key size={13} /> Guardar
                  </button>
                </div>
              </div>
              <button onClick={handleGeneratePin} disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 transition-all duration-200 hover:bg-slate-50"
                style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
                <RefreshCw size={14} /> Generar PIN automaticamente
              </button>
            </>
          )}

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={14} style={{ color: '#DC2626' }} /> <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <CheckCircle2 size={14} style={{ color: '#22C55E' }} /> <p className="text-xs" style={{ color: '#166534' }}>{success}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
            {tab === 'info' && (
              <button onClick={handleSaveInfo} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#0F172A' }}>
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null} Guardar Cambios
              </button>
            )}
            {tab === 'password' && (
              <button onClick={handleSetPassword} disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#0F172A' }}>
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />} Establecer Contrasena
              </button>
            )}
            {tab === 'pin' && null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props { currentUserRole: AppRole; }

export default function UserManagement({ currentUserRole }: Props) {
  const { societies } = useSociety();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers((data ?? []) as UserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.nombre.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = filterStatus === '' ? true : filterStatus === 'activo' ? u.activo : !u.activo;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={loadUsers} currentUserRole={currentUserRole} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={loadUsers} currentUserRole={currentUserRole} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Gestion de Usuarios</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{users.length} usuarios registrados</p>
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
        ) : filtered.length === 0 ? (
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
            {filtered.map((u) => {
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
                    <button onClick={() => setEditingUser(u)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-slate-100" title="Editar usuario">
                      <Edit2 size={13} style={{ color: '#64748B' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
