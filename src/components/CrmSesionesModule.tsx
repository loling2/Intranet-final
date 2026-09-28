import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, Users, User } from 'lucide-react';

interface Props {
  usuarioId: string;
  autorNombre: string;
  isAdmin: boolean;
}

interface Sesion {
  id: string;
  tipo: string;
  tipo_profesional: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  descripcion: string;
  objetivos: string;
  resultados: string;
  participante_nombre: string;
  autor_nombre: string;
}

const PROFESIONALES: Record<string, string> = {
  psicologia: 'Psicología', trabajo_social: 'Trabajo Social', enfermeria: 'Enfermería',
  terapia_ocupacional: 'Terapia Ocupacional', logopedia: 'Logopedia', medicina: 'Medicina',
  psiquiatria: 'Psiquiatría', educacion_social: 'Educación Social', integracion_social: 'Integración Social',
  coordinacion: 'Coordinación', otra: 'Otra',
};

export default function CrmSesionesModule({ usuarioId, autorNombre, isAdmin }: Props) {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('individual');
  const [tipoProf, setTipoProf] = useState('psicologia');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [objetivos, setObjetivos] = useState('');
  const [resultados, setResultados] = useState('');
  const [participante, setParticipante] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_sesiones')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    setSesiones((data ?? []) as Sesion[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return; }
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_sesiones').insert({
      tipo, usuario_servicio_id: tipo === 'individual' ? usuarioId : null,
      tipo_profesional: tipoProf, fecha, hora_inicio: horaInicio, hora_fin: horaFin,
      descripcion: descripcion.trim(), objetivos: objetivos.trim(), resultados: resultados.trim(),
      participante_nombre: participante.trim(), autor_nombre: autorNombre,
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false); setDescripcion(''); setObjetivos(''); setResultados(''); setParticipante('');
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_sesiones').delete().eq('id', id);
    await load();
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Sesiones profesionales</h3>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={12} />Nueva sesión
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : sesiones.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={cardStyle}>
          <Users size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay sesiones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sesiones.map((s) => (
            <div key={s.id} className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.tipo === 'individual' ? '#EFF6FF' : '#F5F3FF' }}>
                    {s.tipo === 'individual' ? <User size={13} style={{ color: '#0369A1' }} /> : <Users size={13} style={{ color: '#7C3AED' }} />}
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: s.tipo === 'individual' ? '#EFF6FF' : '#F5F3FF', color: s.tipo === 'individual' ? '#0369A1' : '#7C3AED' }}>
                    {s.tipo === 'individual' ? 'Individual' : 'Grupal'}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                    {PROFESIONALES[s.tipo_profesional] ?? s.tipo_profesional}
                  </span>
                  <span className="text-xs" style={{ color: '#94A3B8' }}>{s.fecha}{s.hora_inicio ? ` ${s.hora_inicio}` : ''}{s.hora_fin ? `-${s.hora_fin}` : ''}</span>
                </div>
                {isAdmin && <button onClick={() => handleDelete(s.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
              </div>
              <p className="text-sm" style={{ color: '#1E293B' }}>{s.descripcion}</p>
              {s.objetivos && <p className="text-xs mt-1" style={{ color: '#475569' }}><strong>Objetivos:</strong> {s.objetivos}</p>}
              {s.resultados && <p className="text-xs mt-1" style={{ color: '#475569' }}><strong>Resultados:</strong> {s.resultados}</p>}
              {(s.participante || s.autor_nombre) && <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{s.participante ? `Participante: ${s.participante}. ` : ''}{s.autor_nombre ? `Por ${s.autor_nombre}` : ''}</p>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva sesión</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Tipo</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="individual">Individual</option><option value="grupal">Grupal</option>
                  </select></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Profesional</label>
                  <select value={tipoProf} onChange={(e) => setTipoProf(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    {Object.entries(PROFESIONALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Hora inicio</label><input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Hora fin</label><input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Participante(s)</label><input type="text" value={participante} onChange={(e) => setParticipante(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Nombre del participante o grupo" /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Descripción *</label><textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Objetivos</label><input type="text" value={objetivos} onChange={(e) => setObjetivos(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Resultados</label><textarea value={resultados} onChange={(e) => setResultados(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
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
