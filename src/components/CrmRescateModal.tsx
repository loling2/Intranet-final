import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, AlertTriangle } from 'lucide-react';
import { obtenerAutorActual } from '../lib/crmAutor';

export interface ResidenteOption { id: string; nombre: string; apellidos: string | null; }

interface Props {
  residentes: ResidenteOption[];
  residenteInicialId: string;
  onClose: () => void;
  onSaved: () => void;
}

const METODOS: { id: string; label: string }[] = [
  { id: 'quimico', label: 'Química (medicación)' },
  { id: 'fuerza_fisica', label: 'Sujeciones' },
  { id: 'ambos', label: 'Ambos' },
];

const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

function ahoraLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CrmRescateModal({ residentes, residenteInicialId, onClose, onSaved }: Props) {
  const [residenteId, setResidenteId] = useState(residenteInicialId);
  const [fechaHora, setFechaHora] = useState(ahoraLocal);
  const [metodo, setMetodo] = useState('quimico');
  const [medicacion, setMedicacion] = useState('');
  const [dosis, setDosis] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const requiereMedicacion = metodo === 'quimico' || metodo === 'ambos';

  async function handleSave() {
    if (!residenteId) { setError('Selecciona el residente'); return; }
    if (requiereMedicacion && !medicacion.trim()) { setError('Indica la medicación administrada'); return; }
    if (!descripcion.trim()) { setError('Describe el motivo y el tratamiento aplicado'); return; }
    setSaving(true);
    setError('');
    const autor = await obtenerAutorActual();
    const { error: insErr } = await supabase.from('crm_rescates').insert({
      usuario_servicio_id: residenteId,
      fecha_hora: new Date(fechaHora).toISOString(),
      metodo,
      medicacion: requiereMedicacion ? medicacion.trim() : '',
      dosis: requiereMedicacion ? dosis.trim() : '',
      descripcion: descripcion.trim(),
      registrado_por: autor.userId,
      registrado_por_nombre: autor.nombre,
    });
    setSaving(false);
    if (insErr) {
      setError('No se pudo registrar el rescate. Inténtalo de nuevo.');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 font-bold text-base" style={{ color: '#DC2626' }}>
            <AlertTriangle size={16} />Registrar rescate
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }} aria-label="Cerrar"><X size={14} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Residente *</label>
            <select value={residenteId} onChange={(e) => setResidenteId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
              <option value="">Selecciona un residente</option>
              {residentes.map((r) => <option key={r.id} value={r.id}>{`${r.nombre} ${r.apellidos ?? ''}`.trim()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha y hora *</label>
            <input type="datetime-local" value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Método utilizado *</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
              {METODOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          {requiereMedicacion && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Medicación administrada *</label>
                <input type="text" value={medicacion} onChange={(e) => setMedicacion(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Dosis</label>
                <input type="text" value={dosis} onChange={(e) => setDosis(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Motivo y detalle del tratamiento *</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Qué ocurrió, qué se aplicó y cómo evolucionó..." />
          </div>
          {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}>{saving ? 'Registrando...' : 'Registrar rescate'}</button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
