import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, Activity, Users } from 'lucide-react';

interface Props {
  usuarioId: string;
  isAdmin: boolean;
}

interface Abvd {
  id: string;
  fecha: string;
  alimentacion: string;
  higiene: string;
  vestido: string;
  movilidad: string;
  esfinteres: string;
  sueno: string;
  observaciones: string;
  autor_nombre: string;
}

const CAMPOS: { key: keyof Omit<Abvd, 'id' | 'fecha' | 'observaciones' | 'autor_nombre'>; label: string }[] = [
  { key: 'alimentacion', label: 'Alimentación' },
  { key: 'higiene', label: 'Higiene' },
  { key: 'vestido', label: 'Vestido' },
  { key: 'movilidad', label: 'Movilidad' },
  { key: 'esfinteres', label: 'Esfínteres' },
  { key: 'sueno', label: 'Sueño' },
];

const NIVELES: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: 'Normal', color: '#16A34A', bg: '#F0FDF4' },
  asistida: { label: 'Asistida', color: '#D97706', bg: '#FFFBEB' },
  rechaza: { label: 'Rechaza', color: '#DC2626', bg: '#FEF2F2' },
  incontinencia: { label: 'Incontinencia', color: '#DC2626', bg: '#FEF2F2' },
  inmovil: { label: 'Inmóvil', color: '#DC2626', bg: '#FEF2F2' },
  sonda: { label: 'Sonda', color: '#0369A1', bg: '#EFF6FF' },
  alterado: { label: 'Alterado', color: '#D97706', bg: '#FFFBEB' },
  insomnio: { label: 'Insomnio', color: '#DC2626', bg: '#FEF2F2' },
  no_procede: { label: 'No procede', color: '#94A3B8', bg: '#F1F5F9' },
};

export default function CrmAbvdModule({ usuarioId, isAdmin }: Props) {
  const [registros, setRegistros] = useState<Abvd[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<Record<string, string>>({
    alimentacion: 'normal', higiene: 'normal', vestido: 'normal', movilidad: 'normal', esfinteres: 'normal', sueno: 'normal',
  });
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_abvd')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha', { ascending: false })
      .limit(60);
    setRegistros((data ?? []) as Abvd[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_abvd').insert({
      usuario_servicio_id: usuarioId, fecha,
      ...form, observaciones: observaciones.trim(),
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false); setObservaciones('');
      setForm({ alimentacion: 'normal', higiene: 'normal', vestido: 'normal', movilidad: 'normal', esfinteres: 'normal', sueno: 'normal' });
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_abvd').delete().eq('id', id);
    await load();
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Actividades básicas de la vida diaria (ABVD)</h3>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={12} />Nuevo registro
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : registros.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={cardStyle}>
          <Activity size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay registros ABVD</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registros.map((r) => (
            <div key={r.id} className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>{r.fecha}</span>
                  {r.autor_nombre && <span className="text-xs" style={{ color: '#94A3B8' }}>· {r.autor_nombre}</span>}
                </div>
                {isAdmin && (
                  <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CAMPOS.map((c) => {
                  const n = NIVELES[r[c.key]] ?? { label: r[c.key], color: '#475569', bg: '#F1F5F9' };
                  return (
                    <div key={c.key} className="rounded-lg p-2" style={{ backgroundColor: n.bg }}>
                      <p className="text-xs font-medium" style={{ color: '#475569' }}>{c.label}</p>
                      <p className="text-xs font-semibold" style={{ color: n.color }}>{n.label}</p>
                    </div>
                  );
                })}
              </div>
              {r.observaciones && <p className="text-xs mt-2 pt-2" style={{ color: '#64748B', borderTop: '1px solid #F1F5F9' }}>{r.observaciones}</p>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Registro ABVD</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              {CAMPOS.map((c) => (
                <div key={c.key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>{c.label}</label>
                  <select value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    {Object.entries(NIVELES).filter(([k]) => {
                      const validForCampo: Record<string, string[]> = {
                        alimentacion: ['normal', 'asistida', 'rechaza', 'no_procede'],
                        higiene: ['normal', 'asistida', 'rechaza', 'no_procede'],
                        vestido: ['normal', 'asistida', 'rechaza', 'no_procede'],
                        movilidad: ['normal', 'asistida', 'inmovil', 'no_procede'],
                        esfinteres: ['normal', 'incontinencia', 'sonda', 'no_procede'],
                        sueno: ['normal', 'alterado', 'insomnio', 'no_procede'],
                      };
                      return validForCampo[c.key]?.includes(k) ?? true;
                    }).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              ))}
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Observaciones</label><textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
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
