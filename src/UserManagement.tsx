import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Search, Filter, Mail, Shield, CheckCircle2, XCircle, CreditCard as Edit2, Key, Building2, X, Eye, EyeOff, AlertCircle, RefreshCw, ChevronDown, Clock } from 'lucide-react';
import { supabase, UserProfile, AppRole } from './supabaseClient';
import { useAuth } from './context/AuthContext';
import { societies } from './themes';
import { writeAuditLog } from './lib/auditLog';

const ROLE_COLORS: Record<AppRole, { bg: string; text: string; border: string; label: string }> = {
  admin: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Admin' },
  rrhh: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'RRHH' },
  employee: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', label: 'Empleado' },
};

interface InviteModalProps {
  onClose: () => void;
  onInvited: () => void;
  currentUserRole: AppRole;
}

function InviteModal({ onClose, onInvited, currentUserRole }: InviteModalProps) {
  const { profile } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('employee');
  const [selectedSocieties, setSelectedSocieties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const availableRoles: AppRole[] = currentUserRole === 'admin'
    ? ['admin', 'rrhh', 'employee']
    : ['rrhh', 'employee'];

  const toggleSociety = (id: string) => {
    setSelectedSocieties((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleInvite = async () => {
    if (!nombre.trim() || !email.trim()) {
      setError('El nombre y el correo son obligatorios.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Introduce un correo electrónico válido.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Use signUp with a random password - user must use password reset to set their own
      const tempPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!';
      const { data: authData, error: authErr } = await supabase.auth.admin
        ? { data: null, error: new Error('use-service-role') }
        : { data: null, error: new Error('use-service-role') };

      // Since we don't have service role on client, use the invite edge function approach
      // Fallback: create profile record that tracks the pending invitation
      // We'll use supabase.auth.signUp with emailRedirectTo
      const redirectUrl = `${window.location.origin}/?type=invite`;
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: tempPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: { nombre: nombre.trim() },
        },
      });

      if (signUpErr) throw signUpErr;
      if (!signUpData.user) throw new Error('No se pudo crear el usuario.');

      // Create profile
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
      setTimeout(() => {
        onInvited();
        onClose();
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al invitar usuario';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
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
              <h3 className="font-semibold text-base" style={{ color: '#1E293B' }}>Invitacion enviada</h3>
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>Se ha enviado un correo a {email} para que active su cuenta.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nombre completo *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Juan Garcia"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Correo electronico *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Rol</label>
                <div className="flex gap-2">
                  {availableRoles.map((r) => {
                    const rc = ROLE_COLORS[r];
                    return (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer"
                        style={{
                          backgroundColor: role === r ? rc.bg : 'transparent',
                          color: role === r ? rc.text : '#94A3B8',
                          borderColor: role === r ? rc.border : '#E2E8F0',
                        }}
                      >
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
                      <button
                        key={s.id}
                        onClick={() => toggleSociety(s.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer text-left"
                        style={{
                          backgroundColor: isSelected ? s.primaryLight : 'transparent',
                          color: isSelected ? s.primary : '#64748B',
                          borderColor: isSelected ? s.border : '#E2E8F0',
                        }}
                      >
                        <div className="w-5 h-5 rounded flex items-center justify-center font-bold" style={{ backgroundColor: isSelected ? `${s.primary}20` : '#F1F5F9', color: isSelected ? s.primary : '#94A3B8', fontSize: '10px' }}>
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
                  <AlertCircle size={14} style={{ color: '#DC2626' }} />
                  <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleInvite}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#0F172A' }}
                >
                  {loading ? <><RefreshCw size={14} className="animate-spin" /> Enviando...</> : <><Mail size={14} /> Enviar Invitacion</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface EditUserModalProps {
  user: UserProfile;
  onClose: () => void;
  onSaved: () => void;
  currentUserRole: AppRole;
}

function EditUserModal({ user, onClose, onSaved, currentUserRole }: EditUserModalProps) {
  const { profile } = useAuth();
  const [nombre, setNombre] = useState(user.nombre);
  const [role, setRole] = useState<AppRole>(user.role);
  const [activo, setActivo] = useState(user.activo);
  const [selectedSocieties, setSelectedSocieties] = useState<string[]>(user.societies ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'info' | 'password'>('info');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const availableRoles: AppRole[] = currentUserRole === 'admin' ? ['admin', 'rrhh', 'employee'] : ['rrhh', 'employee'];

  const toggleSociety = (id: string) => {
    setSelectedSocieties((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const prevRole = user.role;
      const prevActivo = user.activo;
      const { error: err } = await supabase
        .from('user_profiles')
        .update({ nombre, role, activo, societies: selectedSocieties })
        .eq('id', user.id);
      if (err) throw err;

      if (profile) {
        if (prevRole !== role) {
          await writeAuditLog({
            evento: 'user_role_changed',
            descripcion: `Rol de ${user.email} cambiado de ${prevRole} a ${role}`,
            autor: profile,
            entidad: 'user',
            entidad_id: user.id,
            metadata: { from: prevRole, to: role },
          });
        }
        if (prevActivo !== activo) {
          await writeAuditLog({
            evento: activo ? 'user_activated' : 'user_deactivated',
            descripcion: `Usuario ${user.email} ${activo ? 'activado' : 'desactivado'}`,
            autor: profile,
            entidad: 'user',
            entidad_id: user.id,
          });
        }
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    setError('');
    try {
      // Send password reset email
      const { error: err } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/?type=reset`,
      });
      if (err) throw err;
      if (profile) {
        await writeAuditLog({
          evento: 'password_reset',
          descripcion: `Restablecimiento de contraseña enviado a ${user.email}`,
          autor: profile,
          entidad: 'user',
          entidad_id: user.id,
        });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

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

        <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
          {(['info', 'password'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className="flex-1 py-3 text-sm font-medium cursor-pointer transition-colors duration-200"
              style={{ color: tab === t ? '#0F172A' : '#94A3B8', borderBottom: tab === t ? '2px solid #0F172A' : '2px solid transparent' }}
            >
              {t === 'info' ? 'Informacion' : 'Contraseña'}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {tab === 'info' ? (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Rol</label>
                <div className="flex gap-2">
                  {availableRoles.map((r) => {
                    const rc = ROLE_COLORS[r];
                    return (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        disabled={currentUserRole !== 'admin' && r === 'admin'}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer disabled:opacity-40"
                        style={{
                          backgroundColor: role === r ? rc.bg : 'transparent',
                          color: role === r ? rc.text : '#94A3B8',
                          borderColor: role === r ? rc.border : '#E2E8F0',
                        }}
                      >
                        {rc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Estado</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActivo(true)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer"
                    style={{ backgroundColor: activo ? '#F0FDF4' : 'transparent', color: activo ? '#16A34A' : '#94A3B8', borderColor: activo ? '#BBF7D0' : '#E2E8F0' }}
                  >
                    Activo
                  </button>
                  <button
                    onClick={() => setActivo(false)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer"
                    style={{ backgroundColor: !activo ? '#FEF2F2' : 'transparent', color: !activo ? '#DC2626' : '#94A3B8', borderColor: !activo ? '#FECACA' : '#E2E8F0' }}
                  >
                    Inactivo
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Sociedades</label>
                <div className="grid grid-cols-2 gap-2">
                  {societies.map((s) => {
                    const isSelected = selectedSocieties.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSociety(s.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer text-left"
                        style={{ backgroundColor: isSelected ? s.primaryLight : 'transparent', color: isSelected ? s.primary : '#64748B', borderColor: isSelected ? s.border : '#E2E8F0' }}
                      >
                        <div className="w-5 h-5 rounded flex items-center justify-center font-bold" style={{ backgroundColor: isSelected ? `${s.primary}20` : '#F1F5F9', color: isSelected ? s.primary : '#94A3B8', fontSize: '10px' }}>
                          {s.logoLetter}
                        </div>
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <AlertCircle size={15} style={{ color: '#D97706', flexShrink: 0, marginTop: 2 }} />
                <p className="text-xs" style={{ color: '#92400E' }}>
                  Se enviara un correo de restablecimiento de contraseña al usuario. El campo de nueva contraseña es solo para verificacion.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nueva contraseña (opcional)</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimo 8 caracteres"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Confirmar contraseña</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir contraseña"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={14} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
            <button
              onClick={tab === 'info' ? handleSave : handlePasswordReset}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0F172A' }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
              {tab === 'info' ? 'Guardar Cambios' : 'Enviar Reset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props {
  currentUserRole: AppRole;
}

export default function UserManagement({ currentUserRole }: Props) {
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
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={loadUsers}
          currentUserRole={currentUserRole}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={loadUsers}
          currentUserRole={currentUserRole}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Gestion de Usuarios</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{users.length} usuarios registrados</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: '#0F172A', boxShadow: '0 4px 12px rgba(15,23,42,0.3)' }}
        >
          <UserPlus size={15} />
          Invitar Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
        >
          <option value="">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="rrhh">RRHH</option>
          <option value="employee">Empleado</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
        >
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
            {/* Header */}
            <div className="px-6 py-3 grid grid-cols-12 gap-4 hidden sm:grid" style={{ backgroundColor: '#F8FAFC' }}>
              <div className="col-span-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Usuario</div>
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Rol</div>
              <div className="col-span-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Sociedades</div>
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
                  <div className="sm:col-span-3 flex flex-wrap gap-1">
                    {userSocieties.length === 0 ? (
                      <span className="text-xs" style={{ color: '#94A3B8' }}>Todas</span>
                    ) : (
                      userSocieties.slice(0, 3).map((s) => s && (
                        <span key={s.id} className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: s.primaryLight, color: s.primary }}>
                          {s.logoLetter}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.activo ? '#22C55E' : '#EF4444' }} />
                      <span className="text-xs" style={{ color: u.activo ? '#16A34A' : '#DC2626' }}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                  <div className="sm:col-span-1 flex items-center gap-1">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-slate-100"
                      title="Editar"
                    >
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
