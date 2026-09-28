import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, FileText, Search } from 'lucide-react';

interface Props {
  isAdmin: boolean;
  centros: { id: string; nombre: string }[];
}

interface Acta {
  id: string;
  centro_id: string | null;
  titulo: string;
  tipo: string;
  fecha: string;
  participantes: string;
  contenido: string;
  acuerdos: string;
  autor_nombre: string;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  reunion: { label: 'Reunión', color: '#0369A1', bg: '#EFF6FF' },
  coordinacion: { label: 'Coordinación', color: '#16A34A', bg: '#F0FDF4' },
  equipo: { label: 'Equipo', color: '#D97706', bg: '#FFFBEB' },
  supervision: { label: 'Supervisión', color: '#7C3AED', bg: '#F5F3FF' },
  otra: { label: 'Otra', color: '#475569', bg: '#F1F5F9' },
};

export default function CrmActasModule({ isAdmin, centros }: Props) {
  const [actas, setActas] = useState<Acta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCentro, setFilterCentro] = useState('');
  const [form, setForm] = useState<Omit<Acta, 'id'>>({
    centro_id: null, titulo: '', tipo: 'reunion', fecha: new Date().toISOString().slice(0, 10),
    participantes: '', contenido: '', acuerdos: '', autor_nombre: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_actas')
      .select('*')
      .order('fecha', { ascending: false });
    setActas((data ?? []) as Acta[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.titulo.trim() || !form.contenido.trim()) { setError('Título y contenido son obligatorios'); return; }
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_actas').insert({
      ...form, centro_id: form.centro_id || null,
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false);
      setForm({ centro_id: null, titulo: '', tipo: 'reunion', fecha: new Date().toISOString().slice(0, 10), participantes: '', contenido: '', acuerdos: '', autor_nombre: '' });
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_actas').delete().eq('id', id);
    await load();
  }

  const filtered = actas.filter((a) => {
    if (filterCentro && a.centro_id !== filterCentro) return false;
    if (search && !a.titulo.toLowerCase().includes(search.toLowerCase()) && !a.contenido.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Actas y reuniones</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>Registro de actas y reuniones de equipo</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={14} />Nueva acta
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={cardStyle}>
          <Search size={16} style={{ color: '#64748B' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar acta..." className="flex-1 bg-transparent text-sm outline-none" style={{ color: '#0F172A' }} />
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
          <FileText size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay actas registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const tc = TIPO_CONFIG[a.tipo] ?? TIPO_CONFIG.otra;
            const centro = centros.find((c) => c.id === a.centro_id);
            return (
              <div key={a.id} className="rounded-xl p-5" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>{a.fecha}</span>
                    {centro && <span className="text-xs" style={{ color: '#94A3B8' }}>· {centro.nombre}</span>}
                  </div>
                  {isAdmin && <button onClick={() => handleDelete(a.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: '#0F172A' }}>{a.titulo}</p>
                <p className="text-sm" style={{ color: '#475569' }}>{a.contenido}</p>
                {a.participantes && <p className="text-xs mt-2" style={{ color: '#94A3B8' }}><strong>Participantes:</strong> {a.participantes}</p>}
                {a.acuerdos && <div className="mt-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Acuerdos</p><p className="text-xs" style={{ color: '#64748B' }}>{a.acuerdos}</p></div>}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva acta</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Título *</label><input type="text" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Centro</label>
                <select value={form.centro_id ?? ''} onChange={(e) => setForm({ ...form, centro_id: e.target.value || null })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  <option value="">Sin centro</option>
                  {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Participantes</label><input type="text" value={form.participantes} onChange={(e) => setForm({ ...form, participantes: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Nombres separados por comas" /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Contenido *</label><textarea value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Acuerdos</label><textarea value={form.acuerdos} onChange={(e) => setForm({ ...form, acuerdos: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
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
