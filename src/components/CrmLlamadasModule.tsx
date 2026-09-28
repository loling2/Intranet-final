import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, Phone, Users, Calendar } from 'lucide-react';

interface Props {
  usuarioId: string;
  autorNombre: string;
  isAdmin: boolean;
}

interface Llamada {
  id: string;
  tipo: string;
  fecha: string;
  interlocutor_nombre: string;
  parentesco: string;
  motivo: string;
  observaciones: string;
  autor_nombre: string;
}

const TIPO_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string; bg: string }> = {
  llamada: { label: 'Llamada', icon: Phone, color: '#0369A1', bg: '#EFF6FF' },
  visita: { label: 'Visita', icon: Users, color: '#16A34A', bg: '#F0FDF4' },
  reunion_familia: { label: 'Reunión familia', icon: Calendar, color: '#D97706', bg: '#FFFBEB' },
};

export default function CrmLlamadasModule({ usuarioId, autorNombre, isAdmin }: Props) {
  const [registros, setRegistros] = useState<Llamada[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('llamada');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 16));
  const [interlocutor, setInterlocutor] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_llamadas_visitas')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha', { ascending: false });
    setRegistros((data ?? []) as Llamada[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!motivo.trim() && !observaciones.trim()) { setError('Indica un motivo u observación'); return; }
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_llamadas_visitas').insert({
      usuario_servicio_id: usuarioId, tipo, fecha: new Date(fecha).toISOString(),
      interlocutor_nombre: interlocutor.trim(), parentesco: parentesco.trim(),
      motivo: motivo.trim(), observaciones: observaciones.trim(), autor_nombre: autorNombre,
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false); setInterlocutor(''); setParentesco(''); setMotivo(''); setObservaciones('');
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_llamadas_visitas').delete().eq('id', id);
    await load();
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Llamadas, visitas y reuniones con familias</h3>
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
          <Phone size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay registros de llamadas o visitas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registros.map((r) => {
            const cfg = TIPO_CONFIG[r.tipo] ?? { label: r.tipo, icon: Phone, color: '#475569', bg: '#F1F5F9' };
            const Icon = cfg.icon;
            const dt = new Date(r.fecha);
            return (
              <div key={r.id} className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                      <Icon size={13} style={{ color: cfg.color }} />
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>{dt.toLocaleDateString('es-ES')} {dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                {r.interlocutor_nombre && <p className="text-sm font-medium" style={{ color: '#1E293B' }}>{r.interlocutor_nombre}{r.parentesco ? ` (${r.parentesco})` : ''}</p>}
                {r.motivo && <p className="text-xs mt-1" style={{ color: '#475569' }}><strong>Motivo:</strong> {r.motivo}</p>}
                {r.observaciones && <p className="text-xs mt-1" style={{ color: '#64748B' }}>{r.observaciones}</p>}
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Registrado por {r.autor_nombre}</p>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nuevo registro</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  <option value="llamada">Llamada telefónica</option><option value="visita">Visita familiar</option><option value="reunion_familia">Reunión con familia</option>
                </select></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha y hora</label>
                <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Interlocutor</label><input type="text" value={interlocutor} onChange={(e) => setInterlocutor(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Parentesco</label><input type="text" value={parentesco} onChange={(e) => setParentesco(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Motivo</label><input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
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
