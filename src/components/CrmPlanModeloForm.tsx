import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Loader2 } from 'lucide-react';
import type { Campo, PlanModelo } from '../lib/crmPlanModelos';

export interface PlanGuardado {
  id: string;
  estado: string;
  datos: Record<string, unknown>;
}

type FilaPlan = Record<string, string>;

interface Props {
  modelo: PlanModelo;
  usuarioId: string;
  autorNombre: string;
  plan: PlanGuardado | null;
  onClose: () => void;
  onSaved: () => void;
}

const ESTADOS = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'revisado', etiqueta: 'Revisado' },
  { valor: 'cerrado', etiqueta: 'Cerrado' },
];

const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;
const labelStyle = { color: '#475569' } as const;

export default function CrmPlanModeloForm({ modelo, usuarioId, autorNombre, plan, onClose, onSaved }: Props) {
  const [datos, setDatos] = useState<Record<string, unknown>>(() => plan?.datos ?? {});
  const [estado, setEstado] = useState(plan?.estado ?? 'borrador');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function getTexto(clave: string): string {
    const v = datos[clave];
    return typeof v === 'string' ? v : '';
  }

  function setTexto(clave: string, valor: string) {
    setDatos(prev => ({ ...prev, [clave]: valor }));
  }

  function getFilas(clave: string): FilaPlan[] {
    const v = datos[clave];
    return Array.isArray(v) ? (v as FilaPlan[]) : [];
  }

  function setFilas(clave: string, filas: FilaPlan[]) {
    setDatos(prev => ({ ...prev, [clave]: filas }));
  }

  async function handleSave() {
    setSaving(true); setError('');
    const fechaElaboracion = getTexto('fecha_elaboracion') || null;
    const payload = {
      estado,
      fecha_elaboracion: fechaElaboracion,
      datos,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = plan
      ? await supabase.from(modelo.id).update(payload).eq('id', plan.id)
      : await supabase.from(modelo.id).insert({ ...payload, usuario_servicio_id: usuarioId, creado_por_nombre: autorNombre });
    setSaving(false);
    if (saveError) { setError('No se pudo guardar el plan. Inténtalo de nuevo.'); return; }
    onSaved();
  }

  function renderCampo(campo: Campo) {
    if (campo.tipo === 'filas') {
      const filas = getFilas(campo.clave);
      return (
        <div key={campo.clave} className="space-y-2">
          <p className="text-xs font-medium" style={labelStyle}>{campo.etiqueta}</p>
          {filas.map((fila, idx) => (
            <div key={idx} className="rounded-lg p-3 space-y-2" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              {campo.columnas.map(col => (
                <div key={col.clave}>
                  <label className="block text-xs mb-0.5" style={labelStyle}>{col.etiqueta}</label>
                  <textarea
                    value={fila[col.clave] ?? ''}
                    onChange={(e) => setFilas(campo.clave, filas.map((f, i) => i === idx ? { ...f, [col.clave]: e.target.value } : f))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                    style={inputStyle}
                  />
                </div>
              ))}
              <div className="flex justify-end">
                <button type="button" onClick={() => setFilas(campo.clave, filas.filter((_, i) => i !== idx))}
                  className="flex items-center gap-1 text-xs cursor-pointer px-2 py-1 rounded-md hover:bg-red-50" style={{ color: '#DC2626' }}>
                  <Trash2 size={11} />Quitar fila
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setFilas(campo.clave, [...filas, {}])}
            className="flex items-center gap-1.5 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-lg transition-all"
            style={{ color: '#0369A1', backgroundColor: '#EFF6FF' }}>
            <Plus size={12} />Añadir fila
          </button>
        </div>
      );
    }

    if (campo.tipo === 'select') {
      return (
        <div key={campo.clave}>
          <label className="block text-xs font-medium mb-1" style={labelStyle}>{campo.etiqueta}</label>
          <select value={getTexto(campo.clave)} onChange={(e) => setTexto(campo.clave, e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
            <option value="">Sin indicar</option>
            {campo.opciones.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </div>
      );
    }

    if (campo.tipo === 'area') {
      return (
        <div key={campo.clave}>
          <label className="block text-xs font-medium mb-1" style={labelStyle}>{campo.etiqueta}</label>
          <textarea value={getTexto(campo.clave)} onChange={(e) => setTexto(campo.clave, e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
        </div>
      );
    }

    return (
      <div key={campo.clave}>
        <label className="block text-xs font-medium mb-1" style={labelStyle}>{campo.etiqueta}</label>
        <input type={campo.tipo === 'fecha' ? 'date' : 'text'} value={getTexto(campo.clave)}
          onChange={(e) => setTexto(campo.clave, e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>
            {plan ? `Editar ${modelo.nombre}` : `Nuevo ${modelo.nombre}`}
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Estado del plan</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
              {ESTADOS.map(s => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
            </select>
          </div>

          {modelo.secciones.map(seccion => (
            <section key={seccion.titulo} className="space-y-3">
              <h4 className="text-sm font-semibold pb-1" style={{ color: '#0369A1', borderBottom: '1px solid #E2E8F0' }}>{seccion.titulo}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {seccion.campos.map(campo => (
                  <div key={campo.clave} className={campo.tipo === 'area' || campo.tipo === 'filas' ? 'sm:col-span-2' : ''}>
                    {renderCampo(campo)}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
              {saving && <Loader2 size={13} className="animate-spin" />}{saving ? 'Guardando...' : 'Guardar plan'}
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
