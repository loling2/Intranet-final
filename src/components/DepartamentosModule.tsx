import { useState, useEffect } from 'react';
import {
  Building2, Plus, X, Users, Trash2, Loader2, ChevronDown, ChevronUp, UserPlus,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Departamento {
  id: string;
  nombre: string;
  descripcion: string;
  created_at: string;
}

interface Miembro {
  id: string;
  departamento_id: string;
  user_id: string;
  user_nombre: string;
  created_at: string;
}

interface UserOption {
  id: string;
  nombre: string;
  email: string;
  role: string;
}

export default function DepartamentosModule() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [miembros, setMiembros] = useState<Record<string, Miembro[]>>({});
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Record<string, string>>({});
  const [deletingMember, setDeletingMember] = useState<string | null>(null);
  const [deletingDept, setDeletingDept] = useState<string | null>(null);

  const loadDepartamentos = async () => {
    setLoading(true);
    const { data } = await supabase.from('departamentos').select('*').order('nombre');
    setDepartamentos((data ?? []) as Departamento[]);
    setLoading(false);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, nombre, email, role')
      .eq('activo', true)
      .order('nombre');
    setUsers((data ?? []) as UserOption[]);
  };

  const loadMiembros = async (deptId: string) => {
    const { data } = await supabase
      .from('departamento_miembros')
      .select('*')
      .eq('departamento_id', deptId)
      .order('user_nombre');
    setMiembros((prev) => ({ ...prev, [deptId]: (data ?? []) as Miembro[] }));
  };

  useEffect(() => {
    loadDepartamentos();
    loadUsers();
  }, []);

  const handleToggle = async (deptId: string) => {
    if (expanded === deptId) {
      setExpanded(null);
      return;
    }
    setExpanded(deptId);
    if (!miembros[deptId]) await loadMiembros(deptId);
  };

  const handleCreate = async () => {
    if (!newNombre.trim()) { setCreateError('Introduce un nombre'); return; }
    setCreating(true); setCreateError('');
    const { error } = await supabase.from('departamentos').insert({
      nombre: newNombre.trim(),
      descripcion: newDesc.trim(),
    });
    setCreating(false);
    if (error) { setCreateError(error.message); return; }
    setNewNombre(''); setNewDesc(''); setShowCreate(false);
    await loadDepartamentos();
  };

  const handleDeleteDept = async (deptId: string) => {
    setDeletingDept(deptId);
    await supabase.from('departamentos').delete().eq('id', deptId);
    setDeletingDept(null);
    setExpanded(null);
    await loadDepartamentos();
  };

  const handleAddMember = async (deptId: string) => {
    const userId = selectedUser[deptId];
    if (!userId) return;
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setAddingMember(deptId);
    const { error } = await supabase.from('departamento_miembros').insert({
      departamento_id: deptId,
      user_id: userId,
      user_nombre: user.nombre,
    });
    setAddingMember(null);
    if (!error) {
      setSelectedUser((prev) => ({ ...prev, [deptId]: '' }));
      await loadMiembros(deptId);
    }
  };

  const handleRemoveMember = async (memberId: string, deptId: string) => {
    setDeletingMember(memberId);
    await supabase.from('departamento_miembros').delete().eq('id', memberId);
    setDeletingMember(null);
    await loadMiembros(deptId);
  };

  const getMembersForDept = (deptId: string) => miembros[deptId] ?? [];

  const getAvailableUsers = (deptId: string) => {
    const existing = getMembersForDept(deptId).map((m) => m.user_id);
    return users.filter((u) => !existing.includes(u.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>Departamentos</h2>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            Gestiona los departamentos y sus miembros para el sistema de incidencias
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
        >
          <Plus size={16} />
          Nuevo Departamento
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
          <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Nuevo departamento</h3>
          {createError && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>{createError}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Nombre *</label>
              <input
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Ej: Informatica"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Descripcion</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descripcion opcional"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => { setShowCreate(false); setCreateError(''); setNewNombre(''); setNewDesc(''); }}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
            >
              {creating && <Loader2 size={13} className="animate-spin" />}
              Crear
            </button>
          </div>
        </div>
      )}

      {/* Department list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin" style={{ color: '#0EA5E9' }} />
        </div>
      ) : departamentos.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Building2 size={36} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Sin departamentos</p>
          <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Crea el primero con el boton de arriba</p>
        </div>
      ) : (
        <div className="space-y-3">
          {departamentos.map((dept) => {
            const isOpen = expanded === dept.id;
            const members = getMembersForDept(dept.id);
            const available = getAvailableUsers(dept.id);

            return (
              <div
                key={dept.id}
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
              >
                {/* Department header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
                  >
                    <Building2 size={18} style={{ color: '#2563EB' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{dept.nombre}</p>
                    {dept.descripcion && (
                      <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{dept.descripcion}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                    >
                      <Users size={11} />
                      {isOpen && miembros[dept.id] ? miembros[dept.id].length : '...'}
                    </span>
                    <button
                      onClick={() => handleDeleteDept(dept.id)}
                      disabled={deletingDept === dept.id}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50 disabled:opacity-50"
                      title="Eliminar departamento"
                    >
                      {deletingDept === dept.id
                        ? <Loader2 size={13} className="animate-spin" style={{ color: '#EF4444' }} />
                        : <Trash2 size={13} style={{ color: '#EF4444' }} />}
                    </button>
                    <button
                      onClick={() => handleToggle(dept.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100"
                    >
                      {isOpen ? <ChevronUp size={15} style={{ color: '#64748B' }} /> : <ChevronDown size={15} style={{ color: '#64748B' }} />}
                    </button>
                  </div>
                </div>

                {/* Members panel */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #F1F5F9', backgroundColor: '#FAFBFC' }}>
                    {/* Add member row */}
                    <div className="flex items-center gap-2 px-5 py-3">
                      <select
                        value={selectedUser[dept.id] ?? ''}
                        onChange={(e) => setSelectedUser((prev) => ({ ...prev, [dept.id]: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                        style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: selectedUser[dept.id] ? '#1E293B' : '#94A3B8' }}
                      >
                        <option value="">Selecciona un usuario para añadir...</option>
                        {available.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} — {u.email} ({u.role})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAddMember(dept.id)}
                        disabled={!selectedUser[dept.id] || addingMember === dept.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all"
                        style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
                      >
                        {addingMember === dept.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <UserPlus size={13} />}
                        Añadir
                      </button>
                    </div>

                    {/* Members list */}
                    {members.length === 0 ? (
                      <div className="px-5 pb-4 text-center">
                        <p className="text-xs py-3" style={{ color: '#CBD5E1' }}>Sin miembros. Añade usuarios arriba.</p>
                      </div>
                    ) : (
                      <div className="px-5 pb-4 space-y-2">
                        {members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl"
                            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                                style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
                              >
                                {m.user_nombre.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{m.user_nombre}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(m.id, dept.id)}
                              disabled={deletingMember === m.id}
                              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingMember === m.id
                                ? <Loader2 size={12} className="animate-spin" style={{ color: '#EF4444' }} />
                                : <X size={12} style={{ color: '#EF4444' }} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
