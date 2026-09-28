import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, AlertTriangle, Ambulance, Pill, Phone, Heart } from 'lucide-react';

interface Props {
  usuarioId: string;
  isAdmin: boolean;
}

interface IncidenciaSanitaria {
  id: string;
  tipo: string;
  fecha_hora: string;
  descripcion: string;
  gravedad: string;
  accion_realizada: string;
  requiere_traslado: boolean;
  notificada_familia: boolean;
  estado: string;
  fecha_cierre: string | null;
  autor_nombre: string;
}

const TIPO_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; color: string; bg: string }> = {
  caida: { label: 'Caída', icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
  ambulancia: { label: 'Ambulancia', icon: Ambulance, color: '#DC2626', bg: '#FEF2F2' },
  medicacion: { label: 'Medicación', icon: Pill, color: '#D97706', bg: '#FFFBEB' },
  emergencia: { label: 'Emergencia', icon: Phone, color: '#DC2626', bg: '#FEF2F2' },
  otra: { label: 'Otra', icon: AlertTriangle, color: '#475569', bg: '#F1F5F9' },
};

const GRAVEDAD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  leve: { label: 'Leve', color: '#16A34A', bg: '#F0FDF4' },
  moderada: { label: 'Moderada', color: '#D97706', bg: '#FFFBEB' },
  grave: { label: 'Grave', color: '#DC2626', bg: '#FEF2F2' },
};

export default function CrmIncidenciasSanitariasModule({ usuarioId, isAdmin }: Props) {
  const [registros, setRegistros] = useState<IncidenciaSanitaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('caida');
  const [fechaHora, setFechaHora] = useState(new Date().toISOString().slice(0, 16));
  const [descripcion, setDescripcion] = useState('');
  const [gravedad, setGravedad] = useState('leve');
  const [accion, setAccion] = useState('');
  const [requiereTraslado, setRequiereTraslado] = useState(false);
  const [notificadaFamilia, setNotificadaFamilia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_incidencias_sanitarias')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha_hora', { ascending: false });
    setRegistros((data ?? []) as IncidenciaSanitaria[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return; }
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_incidencias_sanitarias').insert({
      usuario_servicio_id: usuarioId, tipo, fecha_hora: new Date(fechaHora).toISOString(),
      descripcion: descripcion.trim(), gravedad, accion_realizada: accion.trim(),
      requiere_traslado: requiereTraslado, notificada_familia: notificadaFamilia,
      estado: 'abierta', autor_nombre: '',
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false); setDescripcion(''); setAccion(''); setRequiereTraslado(false); setNotificadaFamilia(false);
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_incidencias_sanitarias').delete().eq('id', id);
    await load();
  }

  async function toggleEstado(r: IncidenciaSanitaria) {
    const nuevoEstado = r.estado === 'abierta' ? 'cerrada' : 'abierta';
    await supabase.from('crm_incidencias_sanitarias').update({
      estado: nuevoEstado,
      fecha_cierre: nuevoEstado === 'cerrada' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', r.id);
    await load();
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Incidencias sanitarias y de urgencia</h3>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={12} />Nueva incidencia
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : registros.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={cardStyle}>
          <Heart size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay incidencias sanitarias registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registros.map((r) => {
            const tc = TIPO_CONFIG[r.tipo] ?? TIPO_CONFIG.otra;
            const Icon = tc.icon;
            const gc = GRAVEDAD_CONFIG[r.gravedad] ?? GRAVEDAD_CONFIG.leve;
            return (
              <div key={r.id} className="rounded-xl p-4" style={{ ...cardStyle, borderLeft: `4px solid ${tc.color}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: tc.bg }}>
                      <Icon size={15} style={{ color: tc.color }} />
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: gc.bg, color: gc.color }}>{gc.label}</span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>{new Date(r.fecha_hora).toLocaleDateString('es-ES')} {new Date(r.fecha_hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => toggleEstado(r)} className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md"
                      style={{ backgroundColor: r.estado === 'abierta' ? '#FFFBEB' : '#F0FDF4', color: r.estado === 'abierta' ? '#D97706' : '#16A34A' }}>
                      {r.estado === 'abierta' ? 'Cerrar' : 'Abrir'}
                    </button>
                    {isAdmin && <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
                  </div>
                </div>
                <p className="text-sm" style={{ color: '#1E293B' }}>{r.descripcion}</p>
                {r.accion_realizada && <p className="text-xs mt-1" style={{ color: '#475569' }}><strong>Acción:</strong> {r.accion_realizada}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {r.requiere_traslado && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>Requirió traslado</span>}
                  {r.notificada_familia && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>Familia notificada</span>}
                  {r.fecha_cierre && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Cerrada: {new Date(r.fecha_cierre).toLocaleDateString('es-ES')}</span>}
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
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva incidencia sanitaria</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha y hora</label>
                <input type="datetime-local" value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Descripción *</label>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Describe qué ocurrió..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Gravedad</label>
                <select value={gravedad} onChange={(e) => setGravedad(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  {Object.entries(GRAVEDAD_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Acción realizada</label>
                <textarea value={accion} onChange={(e) => setAccion(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#475569' }}>
                  <input type="checkbox" checked={requiereTraslado} onChange={(e) => setRequiereTraslado(e.target.checked)} className="cursor-pointer" /> Requirió traslado
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#475569' }}>
                  <input type="checkbox" checked={notificadaFamilia} onChange={(e) => setNotificadaFamilia(e.target.checked)} className="cursor-pointer" /> Familia notificada
                </label>
              </div>
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
