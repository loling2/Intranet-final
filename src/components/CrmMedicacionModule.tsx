import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, Pill, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  usuarioId: string;
  isAdmin: boolean;
}

interface Medicacion {
  id: string;
  nombre_medicamento: string;
  dosis: string;
  via: string;
  frecuencia: string;
  hora_inicio: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  prescriptor: string;
  observaciones: string;
  activo: boolean;
}

interface Administracion {
  id: string;
  medicacion_id: string;
  fecha_hora: string;
  administrada: boolean;
  motivo_no_admin: string;
  administrado_por_nombre: string;
  observaciones: string;
}

const VIA_LABELS: Record<string, string> = {
  oral: 'Oral', topica: 'Tópica', intravenosa: 'Intravenosa', intramuscular: 'Intramuscular', subcutanea: 'Subcutánea', otra: 'Otra',
};

export default function CrmMedicacionModule({ usuarioId, isAdmin }: Props) {
  const [medicaciones, setMedicaciones] = useState<Medicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Medicacion, 'id'>>({
    nombre_medicamento: '', dosis: '', via: 'oral', frecuencia: '', hora_inicio: '',
    fecha_inicio: null, fecha_fin: null, prescriptor: '', observaciones: '', activo: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [adminRecords, setAdminRecords] = useState<Record<string, Administracion[]>>({});
  const [showAdminModal, setShowAdminModal] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({ administrada: true, motivo_no_admin: '', observaciones: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_medicacion')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('activo', { ascending: false })
      .order('created_at', { ascending: false });
    const meds = (data ?? []) as Medicacion[];
    setMedicaciones(meds);
    // Load administration records for each medication
    if (meds.length > 0) {
      const { data: adminData } = await supabase
        .from('crm_medicacion_administracion')
        .select('*')
        .in('medicacion_id', meds.map((m) => m.id))
        .order('fecha_hora', { ascending: false })
        .limit(50);
      const byMed: Record<string, Administracion[]> = {};
      for (const a of (adminData ?? []) as Administracion[]) {
        if (!byMed[a.medicacion_id]) byMed[a.medicacion_id] = [];
        byMed[a.medicacion_id].push(a);
      }
      setAdminRecords(byMed);
    }
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.nombre_medicamento.trim()) { setError('El nombre del medicamento es obligatorio'); return; }
    setSaving(true); setError('');
    const payload = { ...form, usuario_servicio_id: usuarioId };
    if (editingId) {
      await supabase.from('crm_medicacion').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
    } else {
      await supabase.from('crm_medicacion').insert(payload);
    }
    setShowForm(false); setEditingId(null);
    setForm({ nombre_medicamento: '', dosis: '', via: 'oral', frecuencia: '', hora_inicio: '', fecha_inicio: null, fecha_fin: null, prescriptor: '', observaciones: '', activo: true });
    await load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_medicacion').delete().eq('id', id);
    await load();
  }

  async function handleToggleActivo(med: Medicacion) {
    await supabase.from('crm_medicacion').update({ activo: !med.activo, updated_at: new Date().toISOString() }).eq('id', med.id);
    await load();
  }

  async function handleSaveAdmin(medId: string) {
    await supabase.from('crm_medicacion_administracion').insert({
      medicacion_id: medId, fecha_hora: new Date().toISOString(),
      administrada: adminForm.administrada, motivo_no_admin: adminForm.motivo_no_admin,
      administrado_por_nombre: '', observaciones: adminForm.observaciones,
    });
    setShowAdminModal(null);
    setAdminForm({ administrada: true, motivo_no_admin: '', observaciones: '' });
    await load();
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Gestión de medicación</h3>
        <button onClick={() => { setEditingId(null); setForm({ nombre_medicamento: '', dosis: '', via: 'oral', frecuencia: '', hora_inicio: '', fecha_inicio: null, fecha_fin: null, prescriptor: '', observaciones: '', activo: true }); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={12} />Nuevo medicamento
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : medicaciones.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={cardStyle}>
          <Pill size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay medicamentos registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {medicaciones.map((m) => (
            <div key={m.id} className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: m.activo ? '#F0FDF4' : '#F1F5F9' }}>
                    <Pill size={15} style={{ color: m.activo ? '#16A34A' : '#94A3B8' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{m.nombre_medicamento}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{m.dosis} · {VIA_LABELS[m.via] ?? m.via} · {m.frecuencia}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setShowAdminModal(m.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                    style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                    <CheckCircle2 size={11} />Registrar dosis
                  </button>
                  <button onClick={() => handleToggleActivo(m)}
                    className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md"
                    style={{ backgroundColor: m.activo ? '#FEF2F2' : '#F0FDF4', color: m.activo ? '#DC2626' : '#16A34A' }}>
                    {m.activo ? 'Suspender' : 'Activar'}
                  </button>
                  <button onClick={() => { setEditingId(m.id); setForm({ nombre_medicamento: m.nombre_medicamento, dosis: m.dosis, via: m.via, frecuencia: m.frecuencia, hora_inicio: m.hora_inicio, fecha_inicio: m.fecha_inicio, fecha_fin: m.fecha_fin, prescriptor: m.prescriptor, observaciones: m.observaciones, activo: m.activo }); setShowForm(true); }}
                    className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>Editar</button>
                  {isAdmin && <button onClick={() => handleDelete(m.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
                </div>
              </div>
              {(m.prescriptor || m.observaciones || m.fecha_inicio) && (
                <div className="mt-2 pt-2 flex flex-wrap gap-3 text-xs" style={{ borderTop: '1px solid #F1F5F9', color: '#94A3B8' }}>
                  {m.prescriptor && <span>Prescriptor: {m.prescriptor}</span>}
                  {m.fecha_inicio && <span>Inicio: {m.fecha_inicio}{m.fecha_fin ? ` → ${m.fecha_fin}` : ''}</span>}
                  {m.hora_inicio && <span>Hora: {m.hora_inicio}</span>}
                </div>
              )}
              {m.observaciones && <p className="text-xs mt-1" style={{ color: '#64748B' }}>{m.observaciones}</p>}
              {adminRecords[m.id] && adminRecords[m.id].length > 0 && (
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#475569' }}>Últimas administraciones ({adminRecords[m.id].length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {adminRecords[m.id].slice(0, 5).map((a) => (
                      <span key={a.id} className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1"
                        style={{ backgroundColor: a.administrada ? '#F0FDF4' : '#FEF2F2', color: a.administrada ? '#16A34A' : '#DC2626' }}>
                        {a.administrada ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {new Date(a.fecha_hora).toLocaleDateString('es-ES')} {new Date(a.fecha_hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingId ? 'Editar medicamento' : 'Nuevo medicamento'}</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Nombre del medicamento *</label>
                <input type="text" value={form.nombre_medicamento} onChange={(e) => setForm({ ...form, nombre_medicamento: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Dosis</label><input type="text" value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Ej: 500mg" /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Vía</label>
                  <select value={form.via} onChange={(e) => setForm({ ...form, via: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    {Object.entries(VIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Frecuencia</label><input type="text" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Ej: Cada 8 horas" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Hora inicio</label><input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha inicio</label><input type="date" value={form.fecha_inicio ?? ''} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value || null })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha fin</label><input type="date" value={form.fecha_fin ?? ''} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value || null })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Prescriptor</label><input type="text" value={form.prescriptor} onChange={(e) => setForm({ ...form, prescriptor: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Observaciones</label><textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
              {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Registrar administración</h3>
              <button onClick={() => setShowAdminModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setAdminForm({ ...adminForm, administrada: true })} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                  style={{ backgroundColor: adminForm.administrada ? '#F0FDF4' : '#F8FAFC', color: adminForm.administrada ? '#16A34A' : '#475569', border: `1px solid ${adminForm.administrada ? '#BBF7D0' : '#E2E8F0'}` }}>
                  <CheckCircle2 size={14} className="inline mr-1" />Administrada
                </button>
                <button onClick={() => setAdminForm({ ...adminForm, administrada: false })} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                  style={{ backgroundColor: !adminForm.administrada ? '#FEF2F2' : '#F8FAFC', color: !adminForm.administrada ? '#DC2626' : '#475569', border: `1px solid ${!adminForm.administrada ? '#FECACA' : '#E2E8F0'}` }}>
                  <XCircle size={14} className="inline mr-1" />No administrada
                </button>
              </div>
              {!adminForm.administrada && (
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Motivo</label><input type="text" value={adminForm.motivo_no_admin} onChange={(e) => setAdminForm({ ...adminForm, motivo_no_admin: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Ej: Rechaza, ausente..." /></div>
              )}
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Observaciones</label><textarea value={adminForm.observaciones} onChange={(e) => setAdminForm({ ...adminForm, observaciones: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
              <div className="flex gap-2">
                <button onClick={() => handleSaveAdmin(showAdminModal)} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>Registrar</button>
                <button onClick={() => setShowAdminModal(null)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
