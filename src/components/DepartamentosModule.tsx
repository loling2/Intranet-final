import { useState, useEffect, useRef } from 'react';
import {
  Building2, Plus, X, Users, Trash2, Loader2, ChevronDown, ChevronUp, UserPlus, Search,
  Eye, EyeOff, UserCog,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Departamento {
  id: string;
  nombre: string;
  descripcion: string;
  visible_incidencias: boolean;
  responsable_id: string | null;
  responsable_nombre: string;
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
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [searchOpen, setSearchOpen] = useState<Record<string, boolean>>({});
  const searchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [deletingMember, setDeletingMember] = useState<string | null>(null);
  const [deletingDept, setDeletingDept] = useState<string | null>(null);
  const [togglingVisible, setTogglingVisible] = useState<string | null>(null);
  const [editingResponsable, setEditingResponsable] = useState<string | null>(null);
  const [responsableSelect, setResponsableSelect] = useState<Record<string, string>>({});
  const [savingResponsable, setSavingResponsable] = useState<string | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setSearchOpen((prev) => {
        const next = { ...prev };
        for (const deptId of Object.keys(prev)) {
          const ref = searchRefs.current[deptId];
          if (ref && !ref.contains(e.target as Node)) {
            next[deptId] = false;
          }
        }
        return next;
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleToggleVisible = async (dept: Departamento) => {
    setTogglingVisible(dept.id);
    const newVal = !dept.visible_incidencias;
    await supabase.from('departamentos').update({ visible_incidencias: newVal }).eq('id', dept.id);
    setTogglingVisible(null);
    await loadDepartamentos();
  };

  const handleSaveResponsable = async (deptId: string) => {
    const userId = responsableSelect[deptId];
    if (!userId) { setEditingResponsable(null); return; }
    const user = users.find((u) => u.id === userId);
    setSavingResponsable(deptId);
    await supabase.from('departamentos').update({
      responsable_id: userId,
      responsable_nombre: user?.nombre ?? '',
    }).eq('id', deptId);
    setSavingResponsable(null);
    setEditingResponsable(null);
    setResponsableSelect((prev) => { const n = { ...prev }; delete n[deptId]; return n; });
    await loadDepartamentos();
  };

  const handleClearResponsable = async (deptId: string) => {
    setSavingResponsable(deptId);
    await supabase.from('departamentos').update({
      responsable_id: null,
      responsable_nombre: '',
    }).eq('id', deptId);
    setSavingResponsable(null);
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
      setSearchQuery((prev) => ({ ...prev, [deptId]: '' }));
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

  const getFilteredUsers = (deptId: string) => {
    const q = (searchQuery[deptId] ?? '').toLowerCase();
    return getAvailableUsers(deptId).filter(
      (u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
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
                    {/* Visibilidad en incidencias */}
                    <button
                      onClick={() => handleToggleVisible(dept)}
                      disabled={togglingVisible === dept.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all disabled:opacity-50"
                      style={
                        dept.visible_incidencias
                          ? { backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }
                          : { backgroundColor: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }
                      }
                      title={dept.visible_incidencias ? 'Visible en incidencias (clic para ocultar)' : 'Oculto en incidencias (clic para mostrar)'}
                    >
                      {togglingVisible === dept.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : dept.visible_incidencias ? <Eye size={11} /> : <EyeOff size={11} />}
                      {dept.visible_incidencias ? 'Visible' : 'Oculto'}
                    </button>

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
                    {/* Responsable row */}
                    <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <UserCog size={15} style={{ color: '#64748B' }} />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>Responsable:</span>
                      {editingResponsable === dept.id ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <select
                            value={responsableSelect[dept.id] ?? ''}
                            onChange={(e) => setResponsableSelect((prev) => ({ ...prev, [dept.id]: e.target.value }))}
                            className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none"
                            style={{ border: '1.5px solid #BAE6FD', backgroundColor: '#F0F9FF', color: '#1E293B' }}
                          >
                            <option value="">Selecciona un usuario...</option>
                            {getMembersForDept(dept.id).map((m) => (
                              <option key={m.user_id} value={m.user_id}>{m.user_nombre}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveResponsable(dept.id)}
                            disabled={savingResponsable === dept.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ backgroundColor: '#059669', color: '#FFFFFF' }}
                          >
                            {savingResponsable === dept.id ? <Loader2 size={12} className="animate-spin" /> : 'Guardar'}
                          </button>
                          <button
                            onClick={() => { setEditingResponsable(null); setResponsableSelect((prev) => { const n = { ...prev }; delete n[dept.id]; return n; }); }}
                            className="px-2 py-1.5 rounded-lg text-xs"
                            style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          {dept.responsable_nombre ? (
                            <>
                              <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{dept.responsable_nombre}</span>
                              <button
                                onClick={() => { setEditingResponsable(dept.id); setResponsableSelect((prev) => ({ ...prev, [dept.id]: dept.responsable_id ?? '' })); }}
                                className="text-xs px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}
                              >
                                Cambiar
                              </button>
                              <button
                                onClick={() => handleClearResponsable(dept.id)}
                                disabled={savingResponsable === dept.id}
                                className="text-xs px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}
                              >
                                Quitar
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-sm" style={{ color: '#94A3B8' }}>Sin responsable asignado</span>
                              <button
                                onClick={() => { setEditingResponsable(dept.id); setResponsableSelect((prev) => ({ ...prev, [dept.id]: '' })); }}
                                className="text-xs px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}
                              >
                                Asignar
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-2 text-xs" style={{ color: '#94A3B8', borderBottom: '1px solid #F1F5F9' }}>
                      El responsable recibe las incidencias enviadas a este departamento y puede derivarlas a cualquier miembro.
                    </div>

                    {/* Add member row */}
                    <div className="flex items-center gap-2 px-5 py-3">
                      <div
                        className="flex-1 relative"
                        ref={(el) => { searchRefs.current[dept.id] = el; }}
                      >
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                          <input
                            type="text"
                            value={searchQuery[dept.id] ?? ''}
                            placeholder={selectedUser[dept.id]
                              ? (users.find((u) => u.id === selectedUser[dept.id])?.nombre ?? 'Buscar trabajador...')
                              : 'Buscar trabajador...'}
                            onChange={(e) => {
                              setSearchQuery((prev) => ({ ...prev, [dept.id]: e.target.value }));
                              setSelectedUser((prev) => ({ ...prev, [dept.id]: '' }));
                              setSearchOpen((prev) => ({ ...prev, [dept.id]: true }));
                            }}
                            onFocus={() => setSearchOpen((prev) => ({ ...prev, [dept.id]: true }))}
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
                            style={{
                              border: `1.5px solid ${selectedUser[dept.id] ? '#0EA5E9' : '#E2E8F0'}`,
                              backgroundColor: '#FFFFFF',
                              color: '#1E293B',
                            }}
                          />
                        </div>
                        {searchOpen[dept.id] && (
                          <div
                            className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden shadow-lg"
                            style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', maxHeight: '220px', overflowY: 'auto' }}
                          >
                            {getFilteredUsers(dept.id).length === 0 ? (
                              <div className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>
                                {getAvailableUsers(dept.id).length === 0 ? 'Todos los usuarios ya son miembros' : 'Sin resultados'}
                              </div>
                            ) : (
                              getFilteredUsers(dept.id).map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSelectedUser((prev) => ({ ...prev, [dept.id]: u.id }));
                                    setSearchQuery((prev) => ({ ...prev, [dept.id]: u.nombre }));
                                    setSearchOpen((prev) => ({ ...prev, [dept.id]: false }));
                                  }}
                                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-slate-50"
                                  style={{ color: '#1E293B' }}
                                >
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                                    style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
                                  >
                                    {u.nombre.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{u.nombre}</p>
                                    <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{u.email}</p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleAddMember(dept.id)}
                        disabled={!selectedUser[dept.id] || addingMember === dept.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all flex-shrink-0"
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
