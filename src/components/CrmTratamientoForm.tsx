import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Plus, Trash2, Save, Loader2, AlertCircle } from 'lucide-react';
import type { Medicacion, Pauta, Tratamiento } from './CrmTratamientosModule';

export interface TratamientoRecord {
  id: string;
  nombre: string;
  motivo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  observaciones: string;
}

interface MedicacionForm {
  key: string;
  nombre: string;
  dosis: string;
  frecuencia: string;
  pauta: Pauta;
}

interface Props {
  usuarioId: string;
  tratamiento: Tratamiento | null;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_MEDICACIONES = 20;

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' };
const labelStyle = { color: '#334155' };

function newKey() {
  return Math.random().toString(36).slice(2);
}

function medicacionesIniciales(tratamiento: Tratamiento | null): MedicacionForm[] {
  if (!tratamiento || tratamiento.crm_tratamiento_medicaciones.length === 0) {
    return [{ key: newKey(), nombre: '', dosis: '', frecuencia: '', pauta: 'manana' }];
  }
  return [...tratamiento.crm_tratamiento_medicaciones]
    .sort((a, b) => a.orden - b.orden)
    .map((m: Medicacion) => ({ key: m.id, nombre: m.nombre, dosis: m.dosis, frecuencia: m.frecuencia_horas?.toString() ?? '', pauta: m.pauta }));
}

export default function CrmTratamientoForm({ usuarioId, tratamiento, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(tratamiento?.nombre ?? '');
  const [motivo, setMotivo] = useState(tratamiento?.motivo ?? '');
  const [fechaInicio, setFechaInicio] = useState(tratamiento?.fecha_inicio ?? '');
  const [fechaFin, setFechaFin] = useState(tratamiento?.fecha_fin ?? '');
  const [estado, setEstado] = useState<'en_proceso' | 'finalizado'>(tratamiento?.estado ?? 'en_proceso');
  const [observaciones, setObservaciones] = useState(tratamiento?.observaciones ?? '');
  const [medicaciones, setMedicaciones] = useState<MedicacionForm[]>(() => medicacionesIniciales(tratamiento));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateMedicacion = (key: string, patch: Partial<MedicacionForm>) => {
    setMedicaciones(prev => prev.map(m => (m.key === key ? { ...m, ...patch } : m)));
  };

  const addMedicacion = () => {
    if (medicaciones.length >= MAX_MEDICACIONES) return;
    setMedicaciones(prev => [...prev, { key: newKey(), nombre: '', dosis: '', frecuencia: '', pauta: 'manana' }]);
  };

  const removeMedicacion = (key: string) => {
    setMedicaciones(prev => (prev.length > 1 ? prev.filter(m => m.key !== key) : prev));
  };

  const handleSave = async () => {
    const nombreLimpio = nombre.trim();
    const medicacionesValidas = medicaciones.filter(m => m.nombre.trim());
    const frecuenciaInvalida = medicacionesValidas.some(m => m.frecuencia.trim() && !(Number.isInteger(Number(m.frecuencia)) && Number(m.frecuencia) >= 1 && Number(m.frecuencia) <= 168));
    if (frecuenciaInvalida) {
      setError('La frecuencia debe ser un número de horas entre 1 y 168.');
      return;
    }
    if (!nombreLimpio) {
      setError('Escribe el nombre del tratamiento.');
      return;
    }
    if (medicacionesValidas.length === 0) {
      setError('Añade al menos una medicación.');
      return;
    }
    setSaving(true);
    setError('');

    const datos = {
      nombre: nombreLimpio,
      motivo: motivo.trim(),
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      estado,
      observaciones: observaciones.trim(),
      updated_at: new Date().toISOString(),
    };

    let tratamientoId = tratamiento?.id ?? '';
    if (tratamiento) {
      const { error: err } = await supabase.from('crm_tratamientos').update(datos).eq('id', tratamiento.id);
      if (err) {
        setSaving(false);
        setError('No se pudo guardar el tratamiento.');
        return;
      }
      const { error: delErr } = await supabase.from('crm_tratamiento_medicaciones').delete().eq('tratamiento_id', tratamiento.id);
      if (delErr) {
        setSaving(false);
        setError('No se pudieron actualizar las medicaciones.');
        return;
      }
    } else {
      const { data, error: err } = await supabase
        .from('crm_tratamientos')
        .insert({ ...datos, usuario_servicio_id: usuarioId })
        .select('id')
        .maybeSingle();
      if (err || !data) {
        setSaving(false);
        setError('No se pudo crear el tratamiento.');
        return;
      }
      tratamientoId = data.id;
    }

    const { error: medErr } = await supabase.from('crm_tratamiento_medicaciones').insert(
      medicacionesValidas.map((m, index) => ({
        tratamiento_id: tratamientoId,
        nombre: m.nombre.trim(),
        dosis: m.dosis.trim(),
        frecuencia_horas: m.frecuencia.trim() ? Number(m.frecuencia) : null,
        pauta: m.pauta,
        orden: index,
      })),
    );
    setSaving(false);
    if (medErr) {
      setError('El tratamiento se guardó, pero no se pudieron guardar las medicaciones. Revisa el tratamiento.');
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.45)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5" style={{ backgroundColor: '#FFFFFF' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base" style={{ color: '#0F172A' }}>{tratamiento ? 'Editar tratamiento' : 'Nuevo tratamiento'}</h3>
          <button onClick={onClose} className="p-1 rounded-md cursor-pointer" aria-label="Cerrar"><X size={18} style={{ color: '#475569' }} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Nombre del tratamiento</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Motivo</label>
            <input value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Fecha de inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Fecha de fin</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value as 'en_proceso' | 'finalizado')} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
              <option value="en_proceso">En proceso</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Medicaciones ({medicaciones.length}/{MAX_MEDICACIONES})</h4>
            <button onClick={addMedicacion} disabled={medicaciones.length >= MAX_MEDICACIONES} className="flex items-center gap-1 text-xs font-medium cursor-pointer disabled:opacity-40" style={{ color: '#0369A1' }}>
              <Plus size={13} /> Añadir medicación
            </button>
          </div>
          {medicaciones.map(m => (
            <div key={m.key} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <input value={m.nombre} onChange={e => updateMedicacion(m.key, { nombre: e.target.value })} placeholder="Medicación" className="sm:col-span-4 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              <input value={m.dosis} onChange={e => updateMedicacion(m.key, { dosis: e.target.value })} placeholder="Dosis" className="sm:col-span-3 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              <input type="number" min={1} max={168} value={m.frecuencia} onChange={e => updateMedicacion(m.key, { frecuencia: e.target.value })} placeholder="Cada X h" title="Frecuencia en horas (8 = cada 8 horas, 24 = una vez al día)" className="sm:col-span-2 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              <select value={m.pauta} onChange={e => updateMedicacion(m.key, { pauta: e.target.value as Pauta })} className="sm:col-span-2 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
                <option value="noche">Noche</option>
              </select>
              <button onClick={() => removeMedicacion(m.key)} disabled={medicaciones.length === 1} className="sm:col-span-1 justify-self-center p-1 cursor-pointer disabled:opacity-30" title="Quitar" aria-label="Quitar medicación">
                <Trash2 size={14} style={{ color: '#DC2626' }} />
              </button>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={labelStyle}>Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
        </div>

        {error && <p className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}><AlertCircle size={12} />{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
