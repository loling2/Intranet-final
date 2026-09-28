import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  usuarioId: string;
  autorNombre: string;
  isAdmin: boolean;
}

interface Pai {
  id: string;
  tipo: string;
  version: number;
  fecha_creacion: string;
  fecha_revision: string | null;
  fecha_cierre: string | null;
  objetivos: string;
  areas_intervencion: string;
  profesionales_involucrados: string;
  evaluacion: string;
  estado: string;
  creado_por_nombre: string;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: '#475569', bg: '#F1F5F9' },
  activo: { label: 'Activo', color: '#16A34A', bg: '#F0FDF4' },
  revisado: { label: 'Revisado', color: '#D97706', bg: '#FFFBEB' },
  cerrado: { label: 'Cerrado', color: '#94A3B8', bg: '#F1F5F9' },
};

export default function CrmPaiModule({ usuarioId, autorNombre, isAdmin }: Props) {
  const [planes, setPlanes] = useState<Pai[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState('PAI');
  const [objetivos, setObjetivos] = useState('');
  const [areas, setAreas] = useState('');
  const [profesionales, setProfesionales] = useState('');
  const [evaluacion, setEvaluacion] = useState('');
  const [estado, setEstado] = useState('borrador');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_pai')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha_creacion', { ascending: false });
    setPlanes((data ?? []) as Pai[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!objetivos.trim() && !areas.trim()) { setError('Indica objetivos o áreas de intervención'); return; }
    setSaving(true); setError('');
    if (editingId) {
      await supabase.from('crm_pai').update({
        tipo, objetivos: objetivos.trim(), areas_intervencion: areas.trim(),
        profesionales_involucrados: profesionales.trim(), evaluacion: evaluacion.trim(),
        estado, updated_at: new Date().toISOString(),
      }).eq('id', editingId);
    } else {
      const { data: existing } = await supabase.from('crm_pai').select('version').eq('usuario_servicio_id', usuarioId).order('version', { ascending: false }).limit(1);
      const nextVersion = ((existing?.[0] as { version: number } | undefined)?.version ?? 0) + 1;
      await supabase.from('crm_pai').insert({
        usuario_servicio_id: usuarioId, tipo, version: nextVersion,
        objetivos: objetivos.trim(), areas_intervencion: areas.trim(),
        profesionales_involucrados: profesionales.trim(), evaluacion: evaluacion.trim(),
        estado, creado_por_nombre: autorNombre,
      });
    }
    setShowForm(false); setEditingId(null); setObjetivos(''); setAreas(''); setProfesionales(''); setEvaluacion(''); setEstado('borrador');
    await load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_pai').delete().eq('id', id);
    await load();
  }

  function openEdit(p: Pai) {
    setEditingId(p.id); setTipo(p.tipo); setObjetivos(p.objetivos); setAreas(p.areas_intervencion);
    setProfesionales(p.profesionales_involucrados); setEvaluacion(p.evaluacion); setEstado(p.estado);
    setShowForm(true);
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Planes de Atención Individualizada (PAI/PIE)</h3>
        <button onClick={() => { setEditingId(null); setTipo('PAI'); setObjetivos(''); setAreas(''); setProfesionales(''); setEvaluacion(''); setEstado('borrador'); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={12} />Nuevo plan
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : planes.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={cardStyle}>
          <FileText size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay planes creados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {planes.map((p) => {
            const ec = ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG.borrador;
            return (
              <div key={p.id} className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{p.tipo} v{p.version}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: ec.bg, color: ec.color }}>{ec.label}</span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>{p.fecha_creacion}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(p)} className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>Editar</button>
                    {isAdmin && <button onClick={() => handleDelete(p.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
                  </div>
                </div>
                {p.objetivos && <div className="mb-2"><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Objetivos</p><p className="text-sm" style={{ color: '#1E293B' }}>{p.objetivos}</p></div>}
                {p.areas_intervencion && <div className="mb-2"><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Áreas de intervención</p><p className="text-sm" style={{ color: '#1E293B' }}>{p.areas_intervencion}</p></div>}
                {p.profesionales_involucrados && <div className="mb-2"><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Profesionales involucrados</p><p className="text-sm" style={{ color: '#1E293B' }}>{p.profesionales_involucrados}</p></div>}
                {p.evaluacion && <div className="mb-2"><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Evaluación</p><p className="text-sm" style={{ color: '#1E293B' }}>{p.evaluacion}</p></div>}
                {(p.fecha_revision || p.fecha_cierre) && (
                  <div className="flex gap-3 mt-2 pt-2 text-xs" style={{ borderTop: '1px solid #F1F5F9', color: '#94A3B8' }}>
                    {p.fecha_revision && <span>Revisión: {p.fecha_revision}</span>}
                    {p.fecha_cierre && <span>Cierre: {p.fecha_cierre}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingId ? 'Editar plan' : 'Nuevo plan PAI/PIE'}</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Tipo</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="PAI">PAI</option><option value="PIE">PIE</option>
                  </select></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Estado</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    {Object.entries(ESTADO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Objetivos</label>
                <textarea value={objetivos} onChange={(e) => setObjetivos(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Objetivos generales y específicos..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Áreas de intervención</label>
                <textarea value={areas} onChange={(e) => setAreas(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Áreas a trabajar..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Profesionales involucrados</label>
                <input type="text" value={profesionales} onChange={(e) => setProfesionales(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Ej: Psicología, Enfermería, Trabajo Social..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Evaluación</label>
                <textarea value={evaluacion} onChange={(e) => setEvaluacion(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
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
