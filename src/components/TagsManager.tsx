import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2, Search, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface TagRow {
  id: string;
  nombre: string;
  created_at: string;
}

export default function TagsManager() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('tags').select('*').order('nombre');
    if (!err) setTags(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { setError('El nombre no puede estar vacio.'); return; }
    if (tags.some((t) => t.nombre.toLowerCase() === trimmed.toLowerCase())) {
      setError('Ya existe un tag con ese nombre.'); return;
    }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('tags').insert({ nombre: trimmed });
    if (err) { setError(err.message); } else { setNewName(''); flash(`Tag "${trimmed}" creado.`); await load(); }
    setSaving(false);
  };

  const handleDelete = async (id: string, nombre: string) => {
    setDeletingId(id);
    const { error: err } = await supabase.from('tags').delete().eq('id', id);
    if (err) { setError(err.message); } else { flash(`Tag "${nombre}" eliminado.`); await load(); }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const filtered = tags.filter((t) =>
    !search || t.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <Tag size={16} style={{ color: '#2563EB' }} />
          </div>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Gestor de Tags de Prevencion</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{tags.length} tags registrados</p>
          </div>
        </div>

        {/* Add new */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#64748B' }}>Nuevo tag</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Nombre del tag (ej: Trabajo en Altura)"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: `1.5px solid ${error ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 transition-all duration-150"
              style={{ backgroundColor: '#0F172A' }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Crear tag
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
              <p className="text-xs" style={{ color: '#16A34A' }}>{success}</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-6 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar tags..."
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

        {/* Tags list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Tag size={32} style={{ color: '#E2E8F0' }} />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>
              {search ? 'Sin resultados para esa busqueda' : 'No hay tags creados'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {filtered.map((tag) => (
              <div key={tag.id} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors duration-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <Tag size={13} style={{ color: '#2563EB' }} />
                </div>
                <span className="flex-1 text-sm font-medium" style={{ color: '#1E293B' }}>{tag.nombre}</span>
                <span className="text-xs hidden sm:block" style={{ color: '#CBD5E1' }}>
                  {new Date(tag.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>

                {confirmDeleteId === tag.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#DC2626' }}>Confirmar?</span>
                    <button
                      onClick={() => handleDelete(tag.id, tag.nombre)}
                      disabled={deletingId === tag.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                      style={{ backgroundColor: '#DC2626' }}>
                      {deletingId === tag.id ? <RefreshCw size={11} className="animate-spin" /> : 'Eliminar'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer"
                      style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(tag.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-red-50"
                    title="Eliminar tag"
                    style={{ color: '#CBD5E1' }}>
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
