import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, Calendar } from 'lucide-react';

interface Props {
  usuarioId: string;
  usuarioNombre: string;
  autorNombre: string;
  isAdmin: boolean;
}

interface Seguimiento {
  id: string;
  fecha: string;
  turno: string;
  descripcion: string;
  intervenciones: string;
  autor_nombre: string;
  created_at: string;
}

const TURNO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  mañana: { label: 'Mañana', color: '#D97706', bg: '#FFFBEB' },
  tarde: { label: 'Tarde', color: '#0369A1', bg: '#EFF6FF' },
  noche: { label: 'Noche', color: '#6D28D9', bg: '#F5F3FF' },
};

export default function CrmSeguimientoModule({ usuarioId, autorNombre, isAdmin }: Props) {
  const [registros, setRegistros] = useState<Seguimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState('mañana');
  const [descripcion, setDescripcion] = useState('');
  const [intervenciones, setIntervenciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_seguimiento_diario')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    setRegistros((data ?? []) as Seguimiento[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return; }
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_seguimiento_diario').insert({
      usuario_servicio_id: usuarioId, fecha, turno, descripcion: descripcion.trim(),
      intervenciones: intervenciones.trim(), autor_nombre: autorNombre,
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false); setDescripcion(''); setIntervenciones('');
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_seguimiento_diario').delete().eq('id', id);
    await load();
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Seguimiento diario e intervenciones</h3>
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
          <Calendar size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay registros de seguimiento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registros.map((r) => {
            const t = TURNO_LABELS[r.turno] ?? { label: r.turno, color: '#475569', bg: '#F1F5F9' };
            return (
              <div key={r.id} className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: t.bg, color: t.color }}>{t.label}</span>
                    <span className="text-xs font-medium" style={{ color: '#475569' }}>{r.fecha}</span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>· {r.autor_nombre}</span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <p className="text-sm" style={{ color: '#1E293B' }}>{r.descripcion}</p>
                {r.intervenciones && (
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Intervenciones</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{r.intervenciones}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nuevo registro de seguimiento</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Turno</label>
                  <select value={turno} onChange={(e) => setTurno(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="mañana">Mañana</option><option value="tarde">Tarde</option><option value="noche">Noche</option>
                  </select></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Descripción *</label>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Describe la situación y observaciones del día..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Intervenciones realizadas</label>
                <textarea value={intervenciones} onChange={(e) => setIntervenciones(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Intervenciones, acciones, medidas tomadas..." /></div>
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
