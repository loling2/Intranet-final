import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, ClipboardList, CheckCircle2 } from 'lucide-react';

interface Props {
  usuarioId: string;
  autorNombre: string;
  isAdmin: boolean;
}

interface Pauta {
  id: string;
  tipo_profesional: string;
  pauta: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  activa: boolean;
  autor_nombre: string;
  created_at: string;
}

const PROFESIONALES: Record<string, string> = {
  psicologia: 'Psicología', trabajo_social: 'Trabajo Social', enfermeria: 'Enfermería',
  terapia_ocupacional: 'Terapia Ocupacional', logopedia: 'Logopedia', medicina: 'Medicina',
  psiquiatria: 'Psiquiatría', educacion_social: 'Educación Social', integracion_social: 'Integración Social',
  coordinacion: 'Coordinación', otra: 'Otra',
};

export default function CrmPautasModule({ usuarioId, autorNombre, isAdmin }: Props) {
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tipoProf, setTipoProf] = useState('psicologia');
  const [pauta, setPauta] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_pautas')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('activa', { ascending: false })
      .order('fecha_inicio', { ascending: false });
    setPautas((data ?? []) as Pauta[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!pauta.trim()) { setError('La pauta es obligatoria'); return; }
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_pautas').insert({
      usuario_servicio_id: usuarioId, tipo_profesional: tipoProf,
      pauta: pauta.trim(), fecha_inicio: fechaInicio, autor_nombre: autorNombre,
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false); setPauta('');
      await load();
    }
    setSaving(false);
  }

  async function handleToggleActiva(p: Pauta) {
    await supabase.from('crm_pautas').update({ activa: !p.activa, fecha_fin: !p.activa ? new Date().toISOString().slice(0, 10) : null, updated_at: new Date().toISOString() }).eq('id', p.id);
    await load();
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_pautas').delete().eq('id', id);
    await load();
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Pautas e indicaciones profesionales</h3>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={12} />Nueva pauta
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : pautas.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={cardStyle}>
          <ClipboardList size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay pautas registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pautas.map((p) => (
            <div key={p.id} className="rounded-xl p-4" style={{ ...cardStyle, opacity: p.activa ? 1 : 0.6 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
                    {PROFESIONALES[p.tipo_profesional] ?? p.tipo_profesional}
                  </span>
                  <span className="text-xs" style={{ color: '#94A3B8' }}>{p.fecha_inicio}{p.fecha_fin ? ` → ${p.fecha_fin}` : ''}</span>
                  {p.activa ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Activa</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F1F5F9', color: '#94A3B8' }}>Inactiva</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleToggleActiva(p)} className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md"
                    style={{ backgroundColor: p.activa ? '#FEF2F2' : '#F0FDF4', color: p.activa ? '#DC2626' : '#16A34A' }}>
                    {p.activa ? 'Desactivar' : 'Activar'}
                  </button>
                  {isAdmin && <button onClick={() => handleDelete(p.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
                </div>
              </div>
              <p className="text-sm" style={{ color: '#1E293B' }}>{p.pauta}</p>
              {p.autor_nombre && <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Por {p.autor_nombre}</p>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva pauta profesional</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Tipo de profesional</label>
                <select value={tipoProf} onChange={(e) => setTipoProf(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  {Object.entries(PROFESIONALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha de inicio</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Pauta / Indicación *</label>
                <textarea value={pauta} onChange={(e) => setPauta(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Describe la pauta o indicación profesional..." /></div>
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
