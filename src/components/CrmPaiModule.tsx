import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, Clock, FileText, Building2, Home, Heart } from 'lucide-react';
import { PLANES_MODELO, type PlanModelo, type TablaPlan } from '../lib/crmPlanModelos';
import CrmPlanModeloForm, { type PlanGuardado } from './CrmPlanModeloForm';
import CrmPaiLegacyList from './CrmPaiLegacyList';

interface Props {
  usuarioId: string;
  autorNombre: string;
  isAdmin: boolean;
}

interface PlanFila extends PlanGuardado {
  modelo: PlanModelo;
  created_at: string;
}

interface Editor {
  modelo: PlanModelo;
  plan: PlanGuardado | null;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: '#475569', bg: '#F1F5F9' },
  activo: { label: 'Activo', color: '#16A34A', bg: '#F0FDF4' },
  revisado: { label: 'Revisado', color: '#D97706', bg: '#FFFBEB' },
  cerrado: { label: 'Cerrado', color: '#94A3B8', bg: '#F1F5F9' },
};

const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;

export default function CrmPaiModule({ usuarioId, autorNombre, isAdmin }: Props) {
  const [planes, setPlanes] = useState<PlanFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const resultados = await Promise.all(
      PLANES_MODELO.map(modelo =>
        supabase.from(modelo.id)
          .select('id, estado, datos, created_at')
          .eq('usuario_servicio_id', usuarioId)
          .order('created_at', { ascending: false })
          .then(res => ({ modelo, ...res }))
      )
    );
    const filas: PlanFila[] = [];
    for (const { modelo, data, error } of resultados) {
      if (error) { setLoadError('No se pudieron cargar los planes.'); setLoading(false); return; }
      for (const row of (data ?? []) as (PlanGuardado & { created_at: string })[]) {
        filas.push({ ...row, modelo });
      }
    }
    filas.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setPlanes(filas);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(fila: PlanFila) {
    const { error } = await supabase.from(fila.modelo.id).delete().eq('id', fila.id);
    if (error) { setLoadError('No se pudo eliminar el plan.'); return; }
    await load();
  }

  function fechaDe(fila: PlanFila): string {
    const f = fila.datos.fecha_elaboracion;
    return typeof f === 'string' && f ? f : fila.created_at.slice(0, 10);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Planes de Atención Individualizada (PAI/PIE)</h3>
        <button onClick={() => setSelectorOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={12} />Nuevo plan
        </button>
      </div>

      {loadError && <p className="text-xs" style={{ color: '#DC2626' }}>{loadError}</p>}

      {loading ? (
        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : planes.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={cardStyle}>
          <FileText size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay planes creados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {planes.map(fila => {
            const ec = ESTADO_CONFIG[fila.estado] ?? ESTADO_CONFIG.borrador;
            return (
              <div key={`${fila.modelo.id}-${fila.id}`} className="rounded-xl p-4 flex items-center justify-between gap-2" style={cardStyle}>
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{fila.modelo.nombre}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: ec.bg, color: ec.color }}>{ec.label}</span>
                  <span className="text-xs" style={{ color: '#94A3B8' }}>{fechaDe(fila)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setEditor({ modelo: fila.modelo, plan: fila })}
                    className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>Editar</button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(fila)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CrmPaiLegacyList usuarioId={usuarioId} />

      {selectorOpen && (
        <SelectorModelo
          onClose={() => setSelectorOpen(false)}
          onElegir={(modelo) => { setSelectorOpen(false); setEditor({ modelo, plan: null }); }}
        />
      )}

      {editor && (
        <CrmPlanModeloForm
          modelo={editor.modelo}
          usuarioId={usuarioId}
          autorNombre={autorNombre}
          plan={editor.plan}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); load(); }}
        />
      )}
    </div>
  );
}

const TEMA_MODELO: Record<TablaPlan, { icono: typeof Building2; fondo: string; borde: string; acento: string; texto: string }> = {
  crm_pai_residencia: { icono: Building2, fondo: '#F0F9FF', borde: '#BAE6FD', acento: '#0369A1', texto: '#075985' },
  crm_pai_spap: { icono: Home, fondo: '#F0FDF4', borde: '#BBF7D0', acento: '#15803D', texto: '#166534' },
  crm_plan_vida: { icono: Heart, fondo: '#FFFBEB', borde: '#FDE68A', acento: '#B45309', texto: '#92400E' },
};

function SelectorModelo({ onClose, onElegir }: { onClose: () => void; onElegir: (modelo: PlanModelo) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.45)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Elige el modelo de plan</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {PLANES_MODELO.map(modelo => {
            const tema = TEMA_MODELO[modelo.id];
            const Icono = tema.icono;
            return (
              <button key={modelo.id} onClick={() => onElegir(modelo)}
                className="group w-full text-left rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{ border: `1px solid ${tema.borde}`, backgroundColor: tema.fondo }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tema.acento, color: '#FFFFFF' }}>
                  <Icono size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: tema.texto }}>{modelo.nombre}</span>
                  <span className="block text-xs mt-0.5" style={{ color: '#475569' }}>{modelo.descripcion}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
