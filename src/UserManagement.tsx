import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, RefreshCw, Edit2 } from 'lucide-react';
import { supabase } from './supabaseClient';

// Definición de colores para roles
const ROLE_COLORS = {
  admin: { bg: '#FEF2F2', text: '#DC2626', label: 'Admin' },
  rrhh: { bg: '#EFF6FF', text: '#2563EB', label: 'RRHH' },
  employee: { bg: '#F0FDF4', text: '#16A34A', label: 'Empleado' },
  prevencion: { bg: '#FFFBEB', text: '#D97706', label: 'Prevencion' }
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('user_profiles').select('*');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error al cargar:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter((u) => {
    const nombre = (u.nombre || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const searchLower = search.toLowerCase();
    const matchSearch = !search || nombre.includes(searchLower) || email.includes(searchLower);
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = filterStatus === '' ? true : filterStatus === 'activo' ? (u.activo === true) : (u.activo === false);
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="w-full p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Gestion de Usuarios</h2>
        <button onClick={() => setShowInvite(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center"><RefreshCw className="animate-spin mx-auto mb-2" /> Cargando...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((u) => {
              const rc = ROLE_COLORS[u.role] || { bg: '#F1F5F9', text: '#64748B', label: u.role || 'N/A' };
              return (
                <div key={u.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{u.nombre || 'Sin nombre'}</p>
                    <p className="text-sm text-slate-500">{u.email}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: rc.bg, color: rc.text }}>{rc.label}</span>
                  <button onClick={() => setEditingUser(u)} className="text-blue-600"><Edit2 size={16}/></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;