import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2, Search, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface CustomRole {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
  created_at: string;
}

const PRESET_COLORS = [
  '#0F172A', '#0369A1', '#0D9488', '#16A34A',
  '#CA8A04', '#DC2626', '#9333EA', '#DB2777',
  '#EA580C', '#64748B',
];

export default function RolesManager() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[1]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('custom_roles').select('*').order('nombre');
    if (!err) setRoles(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  };

  const handleAdd = async () => {
    const trimmed = newNombre.trim();
    if (!trimmed) { setError('El nombre no puede estar vacio.'); return; }
    if (roles.some((r) => r.nombre.toLowerCase() === trimmed.toLowerCase())) {
      setError('Ya existe un rol con ese nombre.'); return;
    }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('custom_roles').insert({
      nombre: trimmed,
      descripcion: newDescripcion.trim(),
      color: newColor,
    });
    if (err) { setError(err.message); } else {
      setNewNombre(''); setNewDescripcion(''); setNewColor(PRESET_COLORS[1]);
      flash(`Rol "${trimmed}" creado.`);
      await load();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, nombre: string) => {
    setDeletingId(id);
    const { error: err } = await supabase.from('custom_roles').delete().eq('id', id);
    if (err) { setError(err.message); } else { flash(`Rol "${nombre}" eliminado.`); await load(); }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const filtered = roles.filter((r) =>
    !search || r.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <ShieldCheck size={16} style={{ color: '#16A34A' }} />
          </div>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Gestor de Roles</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{roles.length} roles registrados</p>
          </div>
        </div>

        {/* Nuevo rol */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#64748B' }}>Nuevo rol</p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={newNombre}
                onChange={(e) => { setNewNombre(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Nombre del rol (ej: Coordinador PRL)"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: `1.5px solid ${error ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
              />
            </div>
            <input
              type="text"
              value={newDescripcion}
              onChange={(e) => setNewDescripcion(e.target.value)}
              placeholder="Descripcion (opcional)"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: '#64748B' }}>Color:</span>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className="w-6 h-6 rounded-full transition-all duration-150 cursor-pointer"
                      style={{
                        backgroundColor: c,
                        outline: newColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                        transform: newColor === c ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white ml-auto"
                style={{ backgroundColor: newColor }}
              >
                <ShieldCheck size={11} />
                {newNombre.trim() || 'Vista previa'}
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={saving || !newNombre.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 transition-all duration-150"
              style={{ backgroundColor: '#0F172A' }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Crear rol
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
              <p className="text-xs" style={{ color: '#16A34A' }}>{success}</p>
            </div>
          )}
        </div>

        {/* Buscador */}
        <div className="px-6 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar roles..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <ShieldCheck size={32} style={{ color: '#E2E8F0' }} />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>
              {search ? 'Sin resultados para esa busqueda' : 'No hay roles creados'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {filtered.map((role) => (
              <div key={role.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors duration-100">
                {/* Color badge */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${role.color}18`, border: `1px solid ${role.color}40` }}
                >
                  <ShieldCheck size={14} style={{ color: role.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{role.nombre}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                      style={{ backgroundColor: role.color }}
                    >
                      Rol
                    </span>
                  </div>
                  {role.descripcion && (
                    <p className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{role.descripcion}</p>
                  )}
                </div>

                <span className="text-xs hidden sm:block flex-shrink-0" style={{ color: '#CBD5E1' }}>
                  {new Date(role.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>

                {confirmDeleteId === role.id ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs" style={{ color: '#DC2626' }}>Confirmar?</span>
                    <button
                      onClick={() => handleDelete(role.id, role.nombre)}
                      disabled={deletingId === role.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                      style={{ backgroundColor: '#DC2626' }}
                    >
                      {deletingId === role.id ? <RefreshCw size={11} className="animate-spin" /> : 'Eliminar'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer"
                      style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(role.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-red-50 flex-shrink-0"
                    title="Eliminar rol"
                    style={{ color: '#CBD5E1' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
