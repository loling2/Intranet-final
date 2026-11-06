import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Pill } from 'lucide-react';
import CrmTratamientoForm, { type TratamientoRecord } from './CrmTratamientoForm';
import CrmTratamientoPermisos from './CrmTratamientoPermisos';

export type Nivel = 'total' | 'editar' | 'ver';
export type Pauta = 'manana' | 'tarde' | 'noche';

export interface Medicacion {
  id: string;
  nombre: string;
  dosis: string;
  frecuencia_horas: number | null;
  pauta: Pauta;
  orden: number;
}

export interface Tratamiento extends TratamientoRecord {
  estado: 'en_proceso' | 'finalizado';
  crm_tratamiento_medicaciones: Medicacion[];
}

interface Props {
  usuarioId: string;
}

type SubTab = 'en_proceso' | 'finalizados' | 'permisos';

const PAUTA_LABEL: Record<Pauta, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

export default function CrmTratamientosModule({ usuarioId }: Props) {
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [nivelLoaded, setNivelLoaded] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('en_proceso');
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tratamiento | null>(null);

  const canEdit = nivel === 'total' || nivel === 'editar';
  const canManagePermisos = nivel === 'total';

  const loadNivel = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('get_crm_tratamiento_nivel', { p_usuario_servicio_id: usuarioId });
    setNivel(err ? null : ((data as Nivel | null) ?? null));
    setNivelLoaded(true);
  }, [usuarioId]);

  const loadTratamientos = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('crm_tratamientos')
      .select('*, crm_tratamiento_medicaciones(*)')
      .eq('usuario_servicio_id', usuarioId)
      .order('created_at', { ascending: false });
    if (err) {
      setError('No se pudieron cargar los tratamientos.');
      setTratamientos([]);
    } else {
      setTratamientos((data ?? []) as Tratamiento[]);
    }
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => {
    loadNivel();
    loadTratamientos();
  }, [loadNivel, loadTratamientos]);

  useEffect(() => {
    if (nivelLoaded && nivel === null) setSubTab('en_proceso');
  }, [nivelLoaded, nivel]);

  const handleDelete = async (tratamiento: Tratamiento) => {
    if (!window.confirm(`¿Eliminar el tratamiento "${tratamiento.nombre}"?`)) return;
    const { error: err } = await supabase.from('crm_tratamientos').delete().eq('id', tratamiento.id);
    if (err) {
      setError('No se pudo eliminar el tratamiento.');
      return;
    }
    loadTratamientos();
  };

  const visibles = tratamientos.filter(t => (subTab === 'finalizados' ? t.estado === 'finalizado' : t.estado === 'en_proceso'));

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'en_proceso', label: 'En proceso' },
    { id: 'finalizados', label: 'Finalizados' },
    ...(canManagePermisos ? [{ id: 'permisos' as const, label: 'Permisos' }] : []),
  ];

  if (!nivelLoaded || loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin" style={{ color: '#0369A1' }} />
      </div>
    );
  }

  if (nivel === null) {
    return <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>No tienes acceso a los tratamientos de este residente.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: '#F1F5F9' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
              style={{ backgroundColor: subTab === tab.id ? '#FFFFFF' : 'transparent', color: subTab === tab.id ? '#0F172A' : '#475569', boxShadow: subTab === tab.id ? '0 1px 2px rgba(15,23,42,0.08)' : 'none' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {subTab !== 'permisos' && canEdit && (
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
          >
            <Plus size={14} /> Añadir tratamiento
          </button>
        )}
      </div>

      {error && <p className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}><AlertCircle size={12} />{error}</p>}

      {subTab === 'permisos' && canManagePermisos ? (
        <CrmTratamientoPermisos usuarioId={usuarioId} />
      ) : visibles.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>
          {subTab === 'finalizados' ? 'No hay tratamientos finalizados' : 'No hay tratamientos en proceso'}
        </p>
      ) : (
        <div className="space-y-3">
          {visibles.map(tratamiento => (
            <div key={tratamiento.id} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{tratamiento.nombre}</p>
                  {tratamiento.motivo && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{tratamiento.motivo}</p>}
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                    {tratamiento.fecha_inicio ? `Desde ${tratamiento.fecha_inicio}` : 'Sin fecha de inicio'}
                    {tratamiento.fecha_fin ? ` · Hasta ${tratamiento.fecha_fin}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditing(tratamiento); setFormOpen(true); }} className="p-1.5 rounded-md cursor-pointer" title="Editar" style={{ color: '#0369A1' }}><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(tratamiento)} className="p-1.5 rounded-md cursor-pointer" title="Eliminar" style={{ color: '#DC2626' }}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1.5">
                {[...tratamiento.crm_tratamiento_medicaciones].sort((a, b) => a.orden - b.orden).map(med => (
                  <div key={med.id} className="flex items-center gap-2 text-xs" style={{ color: '#1E293B' }}>
                    <Pill size={12} style={{ color: '#0369A1' }} />
                    <span className="font-medium">{med.nombre}</span>
                    {med.dosis && <span style={{ color: '#64748B' }}>· {med.dosis}</span>}
                    {med.frecuencia_horas && <span style={{ color: '#64748B' }}>· cada {med.frecuencia_horas} h</span>}
                    <span className="ml-auto px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>{PAUTA_LABEL[med.pauta]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <CrmTratamientoForm
          usuarioId={usuarioId}
          tratamiento={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); loadTratamientos(); }}
        />
      )}
    </div>
  );
}
