import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Search, CheckCircle2,
  CreditCard as Edit2, Key, X,
  RefreshCw, Hash,
} from 'lucide-react';
import { supabase, UserProfile, AppRole } from './supabaseClient';
import { useAuth } from './context/AuthContext';
import { useSociety } from './context/SocietyContext';
import { writeAuditLog } from './lib/auditLog';

// --- Imports de componentes (Asumiendo que existen en tu proyecto) ---
// import InviteModal from './InviteModal';
// import EditUserModal from './EditUserModal';

const ROLE_COLORS: Record<AppRole, { bg: string; text: string; border: string; label: string }> = {
  admin:     { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Admin' },
  rrhh:      { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'RRHH' },
  employee:  { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', label: 'Empleado' },
  prevencion:{ bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'Prevencion' },
};

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
    const matchSearch = !search || 
      u.nombre.toLowerCase().includes(search.toLowerCase()) || 
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = filterStatus === '' ? true : filterStatus === 'activo' ? u.activo : !u.activo;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div>
      {/* Modales */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={loadUsers} currentUserRole={currentUserRole} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={loadUsers} currentUserRole={currentUserRole} />}

      {/* Header */}
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

      {/* Filtros */}
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

      {/* Tabla */}
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
            {filtered.map((u) => {
              const rc = ROLE_COLORS[u.role] || ROLE_COLORS.employee;
              const userSocieties = (u.societies ?? []).map((sid) => societies.find((s) => s.id === sid)).filter(Boolean);
              return (
                <div key={u.id} className="px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors duration-150">
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{u.nombre}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{u.email}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>
                      {rc.label}
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex gap-1">
                    {userSocieties.map((s) => s && (
                      <span key={s.id} className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: s.primaryLight, color: s.primary }}>{s.logoLetter}</span>
                    ))}
                  </div>
                  <div className="sm:col-span-1">
                    {u.pin ? <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-green-50 text-green-700">{u.pin}</span> : '—'}
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.activo ? '#22C55E' : '#EF4444' }} />
                    <span className="text-xs" style={{ color: u.activo ? '#16A34A' : '#DC2626' }}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <div className="sm:col-span-1 text-right">
                    <button onClick={() => setEditingUser(u)} className="p-2 rounded-lg hover:bg-slate-100"><Edit2 size={14} /></button>
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