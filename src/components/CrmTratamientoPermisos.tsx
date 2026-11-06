import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle } from 'lucide-react';

type AccesoPuesto = '' | 'ver' | 'editar';

interface PuestoTag {
  id: string;
  nombre: string;
}

interface Props {
  usuarioId: string;
}

const selectStyle = { backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' };

export default function CrmTratamientoPermisos({ usuarioId }: Props) {
  const [puestos, setPuestos] = useState<PuestoTag[]>([]);
  const [accesos, setAccesos] = useState<Record<string, AccesoPuesto>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [puestosRes, permisosRes] = await Promise.all([
      supabase.from('puesto_tags').select('id, nombre').order('nombre'),
      supabase.from('crm_tratamiento_permisos').select('puesto_tag_id, nivel').eq('usuario_servicio_id', usuarioId),
    ]);
    if (puestosRes.error || permisosRes.error) {
      setError('No se pudieron cargar los permisos.');
      setLoading(false);
      return;
    }
    setPuestos((puestosRes.data ?? []) as PuestoTag[]);
    const mapa: Record<string, AccesoPuesto> = {};
    for (const fila of permisosRes.data ?? []) {
      mapa[fila.puesto_tag_id] = fila.nivel as AccesoPuesto;
    }
    setAccesos(mapa);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => {
    load();
  }, [load]);

  const cambiarAcceso = async (puestoId: string, valor: AccesoPuesto) => {
    setSavingId(puestoId);
    setError('');
    const { error: err } = valor === ''
      ? await supabase.from('crm_tratamiento_permisos').delete().eq('usuario_servicio_id', usuarioId).eq('puesto_tag_id', puestoId)
      : await supabase.from('crm_tratamiento_permisos').upsert(
          { usuario_servicio_id: usuarioId, puesto_tag_id: puestoId, nivel: valor },
          { onConflict: 'usuario_servicio_id,puesto_tag_id' },
        );
    setSavingId(null);
    if (err) {
      setError('No se pudo guardar el permiso.');
      return;
    }
    setAccesos(prev => ({ ...prev, [puestoId]: valor }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin" style={{ color: '#0369A1' }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#64748B' }}>Elige qué puede hacer cada puesto de trabajo con los tratamientos de este residente.</p>
      {error && <p className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}><AlertCircle size={12} />{error}</p>}
      {puestos.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>No hay puestos de trabajo definidos</p>
      ) : (
        puestos.map(puesto => (
          <div key={puesto.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{puesto.nombre}</span>
            <select
              value={accesos[puesto.id] ?? ''}
              disabled={savingId === puesto.id}
              onChange={e => cambiarAcceso(puesto.id, e.target.value as AccesoPuesto)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer disabled:opacity-60"
              style={selectStyle}
            >
              <option value="">Sin acceso</option>
              <option value="ver">Solo ver</option>
              <option value="editar">Ver, editar y borrar</option>
            </select>
          </div>
        ))
      )}
    </div>
  );
}
