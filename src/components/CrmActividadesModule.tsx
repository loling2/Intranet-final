import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, Calendar, Users, Search } from 'lucide-react';

interface Props {
  isAdmin: boolean;
  centros: { id: string; nombre: string }[];
}

interface Actividad {
  id: string;
  centro_id: string | null;
  titulo: string;
  descripcion: string;
  tipo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  responsable_nombre: string;
}

interface Participante {
  id: string;
  usuario_servicio_id: string;
  observaciones: string;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  taller: { label: 'Taller', color: '#0369A1', bg: '#EFF6FF' },
  actividad: { label: 'Actividad', color: '#16A34A', bg: '#F0FDF4' },
  ocio: { label: 'Ocio', color: '#D97706', bg: '#FFFBEB' },
  terapia: { label: 'Terapia', color: '#7C3AED', bg: '#F5F3FF' },
  formacion: { label: 'Formación', color: '#0369A1', bg: '#EFF6FF' },
  otra: { label: 'Otra', color: '#475569', bg: '#F1F5F9' },
};

export default function CrmActividadesModule({ isAdmin, centros }: Props) {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCentro, setFilterCentro] = useState('');
  const [form, setForm] = useState<Omit<Actividad, 'id'>>({
    centro_id: null, titulo: '', descripcion: '', tipo: 'taller',
    fecha: new Date().toISOString().slice(0, 10), hora_inicio: '', hora_fin: '', responsable_nombre: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_actividades')
      .select('*')
      .order('fecha', { ascending: false });
    setActividades((data ?? []) as Actividad[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_actividades').insert({
      ...form, centro_id: form.centro_id || null,
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false);
      setForm({ centro_id: null, titulo: '', descripcion: '', tipo: 'taller', fecha: new Date().toISOString().slice(0, 10), hora_inicio: '', hora_fin: '', responsable_nombre: '' });
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_actividades').delete().eq('id', id);
    await load();
  }

  const filtered = actividades.filter((a) => {
    if (filterCentro && a.centro_id !== filterCentro) return false;
    if (search && !a.titulo.toLowerCase().includes(search.toLowerCase()) && !a.descripcion.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Actividades y talleres</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>Gestión de actividades y participación</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={14} />Nueva actividad
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={cardStyle}>
          <Search size={16} style={{ color: '#64748B' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar actividad..." className="flex-1 bg-transparent text-sm outline-none" style={{ color: '#0F172A' }} />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={cardStyle}>
          <select value={filterCentro} onChange={(e) => setFilterCentro(e.target.value)} className="bg-transparent text-sm outline-none cursor-pointer" style={{ color: '#0F172A' }}>
            <option value="">Todos los centros</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Clock size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={cardStyle}>
          <Calendar size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay actividades</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const tc = TIPO_CONFIG[a.tipo] ?? TIPO_CONFIG.otra;
            const centro = centros.find((c) => c.id === a.centro_id);
            return (
              <div key={a.id} className="rounded-xl p-5" style={cardStyle}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                  {isAdmin && <button onClick={() => handleDelete(a.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: '#0F172A' }}>{a.titulo}</p>
                {a.descripcion && <p className="text-xs mb-2" style={{ color: '#64748B' }}>{a.descripcion}</p>}
                <div className="flex flex-wrap gap-2 text-xs" style={{ color: '#94A3B8' }}>
                  <span className="flex items-center gap-1"><Calendar size={11} />{a.fecha}{a.hora_inicio ? ` ${a.hora_inicio}` : ''}</span>
                  {centro && <span>{centro.nombre}</span>}
                  {a.responsable_nombre && <span>· {a.responsable_nombre}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva actividad</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Título *</label><input type="text" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Centro</label>
                  <select value={form.centro_id ?? ''} onChange={(e) => setForm({ ...form, centro_id: e.target.value || null })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="">Sin centro</option>
                    {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Hora inicio</label><input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Hora fin</label><input type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Responsable</label><input type="text" value={form.responsable_nombre} onChange={(e) => setForm({ ...form, responsable_nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Descripción</label><textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
              {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
