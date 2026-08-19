import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Search, Pencil, Trash2, X, Check, RefreshCw,
  AlertCircle, Loader2, MapPin, Tablet, Monitor,
} from 'lucide-react';
import { supabase, type Sociedad, type Centro } from '../supabaseClient';

interface KioskDeviceSummary {
  id: string;
  site_name: string;
  is_active: boolean;
}

export default function CentrosModule() {
  const [centros, setCentros] = useState<Centro[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [kioskDevices, setKioskDevices] = useState<Record<string, KioskDeviceSummary[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSociedad, setFilterSociedad] = useState('');

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formSociedad, setFormSociedad] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [cenRes, socRes, kioskRes] = await Promise.all([
      supabase.from('centros').select('id, nombre, id_sociedad').order('nombre', { ascending: true }),
      supabase.from('sociedades').select('id, nombre').order('nombre', { ascending: true }),
      supabase.from('kiosk_devices').select('id, site_name, is_active, centro_id').order('site_name', { ascending: true }),
    ]);
    if (cenRes.error) {
      setError(cenRes.error.message);
      setCentros([]);
    } else {
      setCentros((cenRes.data as Centro[]) ?? []);
    }
    if (socRes.error) {
      setError(socRes.error.message);
      setSociedades([]);
    } else {
      setSociedades((socRes.data as Sociedad[]) ?? []);
    }
    if (kioskRes.error) {
      setKioskDevices({});
    } else {
      const map: Record<string, KioskDeviceSummary[]> = {};
      for (const d of (kioskRes.data as (KioskDeviceSummary & { centro_id: string | null })[]) ?? []) {
        if (d.centro_id) {
          if (!map[d.centro_id]) map[d.centro_id] = [];
          map[d.centro_id].push({ id: d.id, site_name: d.site_name, is_active: d.is_active });
        }
      }
      setKioskDevices(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = centros.filter((c) => {
    if (!search.trim() && !filterSociedad) return true;
    const q = search.toLowerCase();
    const matchSearch = !search.trim() || (c.nombre ?? '').toLowerCase().includes(q);
    const matchSoc = !filterSociedad || c.id_sociedad === filterSociedad;
    return matchSearch && matchSoc;
  });

  function openNew() {
    setEditId(null);
    setFormNombre('');
    setFormSociedad('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(c: Centro) {
    setEditId(c.id);
    setFormNombre(c.nombre);
    setFormSociedad(c.id_sociedad ?? '');
    setFormError('');
    setShowForm(true);
  }

  async function save() {
    if (!formNombre.trim()) { setFormError('El nombre del centro es obligatorio'); return; }
    if (!formSociedad) { setFormError('Debes asignar el centro a una sociedad'); return; }
    setSaving(true);
    setFormError('');
    const payload = { nombre: formNombre.trim(), id_sociedad: formSociedad };
    if (editId) {
      const { error: err } = await supabase.from('centros').update(payload).eq('id', editId);
      if (err) { setFormError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('centros').insert(payload);
      if (err) { setFormError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setShowForm(false);
    await load();
  }

  async function deleteCentro(c: Centro) {
    const tablets = kioskDevices[c.id] ?? [];
    const msg = tablets.length > 0
      ? `¿Eliminar el centro "${c.nombre}"? Tiene ${tablets.length} tablet(s) asignada(s). Se desvincularan pero no se borraran.`
      : `¿Eliminar el centro "${c.nombre}"? Esta accion no se puede deshacer.`;
    if (!confirm(msg)) return;
    setDeletingId(c.id);
    if (tablets.length > 0) {
      await supabase.from('kiosk_devices').update({ centro_id: null }).eq('centro_id', c.id);
    }
    await supabase.from('centros').delete().eq('id', c.id);
    await load();
    setDeletingId(null);
  }

  function getSociedadNombre(id: string | null): string {
    if (!id) return 'Sin sociedad';
    return sociedades.find((s) => s.id === id)?.nombre ?? 'Sin sociedad';
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#0F172A' }}>Centros de Trabajo</h3>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Gestiona los centros asignados a sociedades y sus tablets de fichaje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }} title="Actualizar">
            <RefreshCw size={15} />
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer" style={{ backgroundColor: '#0F172A' }}>
            <Plus size={15} /> Nuevo centro
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar centro..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
          />
        </div>
        <select
          value={filterSociedad}
          onChange={(e) => setFilterSociedad(e.target.value)}
          className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
        >
          <option value="">Todas las sociedades</option>
          {sociedades.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FECACA' }}>
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#B91C1C' }} />
          <p className="text-sm" style={{ color: '#B91C1C' }}>{error}</p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#94A3B8' }}>
          <Loader2 size={16} className="animate-spin" /> Cargando centros...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Building2 size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>No hay centros que mostrar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const tablets = kioskDevices[c.id] ?? [];
            const activeTablets = tablets.filter((t) => t.is_active).length;
            return (
              <div key={c.id} className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                      <Building2 size={16} style={{ color: '#0369A1' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{c.nombre}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>{getSociedadNombre(c.id_sociedad)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(c)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" title="Editar" style={{ color: '#475569' }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => deleteCentro(c)} disabled={deletingId === c.id} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-50 disabled:opacity-50" title="Eliminar" style={{ color: '#DC2626' }}>
                      {deletingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>

                {/* Tablets asignadas */}
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Tablet size={11} style={{ color: '#64748B' }} />
                    <span className="text-xs font-medium" style={{ color: '#64748B' }}>
                      {tablets.length} tablet{tablets.length !== 1 ? 's' : ''} asignada{tablets.length !== 1 ? 's' : ''}
                      {activeTablets > 0 && <span style={{ color: '#16A34A' }}> · {activeTablets} activa{activeTablets !== 1 ? 's' : ''}</span>}
                    </span>
                  </div>
                  {tablets.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tablets.map((t) => (
                        <span key={t.id} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: t.is_active ? '#F0FDF4' : '#F1F5F9', color: t.is_active ? '#16A34A' : '#94A3B8', border: `1px solid ${t.is_active ? '#BBF7D0' : '#E2E8F0'}` }}>
                          {t.site_name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: '#CBD5E1' }}>Sin tablets asignadas</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0', backgroundColor: '#0F172A' }}>
              <div className="flex items-center gap-2">
                <Building2 size={16} style={{ color: '#22D3EE' }} />
                <span className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{editId ? 'Editar centro' : 'Nuevo centro'}</span>
              </div>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: '#475569' }}><X size={14} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#475569' }}>Nombre del centro *</label>
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="ej: Oficina Madrid"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#475569' }}>Sociedad *</label>
                <select
                  value={formSociedad}
                  onChange={(e) => setFormSociedad(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                >
                  <option value="">Selecciona una sociedad</option>
                  {sociedades.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              {formError && (
                <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <AlertCircle size={12} /> {formError}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? 'Guardando...' : (editId ? 'Guardar' : 'Crear')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
