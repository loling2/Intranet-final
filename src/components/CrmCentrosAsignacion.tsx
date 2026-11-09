import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, Search, Building2 } from 'lucide-react';

interface EmpleadoRow {
  user_id: string;
  nombre: string;
  apellidos: string | null;
  puesto_tag_id: string | null;
}

interface CentroRow {
  id: string;
  nombre: string;
}

interface AsignacionRow {
  user_id: string;
  centro_id: string;
}

const MAX_RESULTADOS = 50;

export default function CrmCentrosAsignacion() {
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [puestos, setPuestos] = useState<Record<string, string>>({});
  const [centros, setCentros] = useState<CentroRow[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [savingCentroId, setSavingCentroId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      const [empRes, puestosRes, centrosRes, asigRes] = await Promise.all([
        supabase.from('empleados').select('user_id, nombre, apellidos, puesto_tag_id')
          .eq('activo', true).not('user_id', 'is', null).order('nombre'),
        supabase.from('puesto_tags').select('id, nombre'),
        supabase.from('centros').select('id, nombre').order('nombre'),
        supabase.from('crm_usuario_centros').select('user_id, centro_id'),
      ]);
      if (empRes.error || puestosRes.error || centrosRes.error || asigRes.error) {
        setError('No se pudieron cargar los centros asignados.');
        setLoading(false);
        return;
      }
      setEmpleados((empRes.data ?? []) as EmpleadoRow[]);
      setPuestos(Object.fromEntries(((puestosRes.data ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre])));
      setCentros((centrosRes.data ?? []) as CentroRow[]);
      const mapa: Record<string, Set<string>> = {};
      for (const row of (asigRes.data ?? []) as AsignacionRow[]) {
        (mapa[row.user_id] ??= new Set()).add(row.centro_id);
      }
      setAsignaciones(mapa);
      setLoading(false);
    })();
  }, []);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = q
      ? empleados.filter((e) => `${e.nombre} ${e.apellidos ?? ''}`.toLowerCase().includes(q))
      : empleados;
    return filtrados.slice(0, MAX_RESULTADOS);
  }, [empleados, busqueda]);

  const seleccionado = empleados.find((e) => e.user_id === selectedUserId) ?? null;
  const centrosSeleccionados = seleccionado ? asignaciones[seleccionado.user_id] ?? new Set<string>() : new Set<string>();

  const toggleCentro = async (centroId: string) => {
    if (!seleccionado) return;
    const userId = seleccionado.user_id;
    const activo = centrosSeleccionados.has(centroId);
    setSavingCentroId(centroId); setError('');
    const { error: err } = activo
      ? await supabase.from('crm_usuario_centros').delete().eq('user_id', userId).eq('centro_id', centroId)
      : await supabase.from('crm_usuario_centros').insert({ user_id: userId, centro_id: centroId });
    if (err) {
      setError('No se pudo guardar el cambio. Inténtalo de nuevo.');
    } else {
      setAsignaciones((prev) => {
        const nuevo = new Set(prev[userId] ?? []);
        if (activo) nuevo.delete(centroId); else nuevo.add(centroId);
        return { ...prev, [userId]: nuevo };
      });
    }
    setSavingCentroId(null);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} />
        <p className="text-sm" style={{ color: '#64748B' }}>Cargando trabajadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Centros por trabajador</h2>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Asigna uno o varios centros. El trabajador verá los residentes de esos centros.
        </p>
      </div>
      {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar trabajador..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }} />
          </div>
          <div className="rounded-xl divide-y" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            {resultados.length === 0 && (
              <p className="text-sm px-4 py-6 text-center" style={{ color: '#64748B' }}>No hay trabajadores que coincidan</p>
            )}
            {resultados.map((e) => {
              const sel = e.user_id === selectedUserId;
              const numCentros = asignaciones[e.user_id]?.size ?? 0;
              return (
                <button key={e.user_id} onClick={() => setSelectedUserId(e.user_id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
                  style={{ backgroundColor: sel ? '#E0F2FE' : '#FFFFFF' }}>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate" style={{ color: '#0F172A' }}>
                      {e.nombre} {e.apellidos ?? ''}
                    </span>
                    <span className="block text-xs truncate" style={{ color: '#64748B' }}>
                      {(e.puesto_tag_id && puestos[e.puesto_tag_id]) || 'Sin puesto'}
                    </span>
                  </span>
                  <span className="text-xs font-medium whitespace-nowrap" style={{ color: numCentros > 0 ? '#0369A1' : '#94A3B8' }}>
                    {numCentros} {numCentros === 1 ? 'centro' : 'centros'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          {!seleccionado && (
            <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <Building2 size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
              <p className="text-sm" style={{ color: '#64748B' }}>Selecciona un trabajador para ver sus centros</p>
            </div>
          )}
          {seleccionado && (
            <div className="rounded-xl divide-y" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="px-4 py-3">
                <h4 className="text-sm font-bold" style={{ color: '#0F172A' }}>{seleccionado.nombre} {seleccionado.apellidos ?? ''}</h4>
                <p className="text-xs" style={{ color: '#64748B' }}>Activa los centros donde trabaja</p>
              </div>
              {centros.map((c) => {
                const activo = centrosSeleccionados.has(c.id);
                const guardando = savingCentroId === c.id;
                return (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{c.nombre}</span>
                    <button role="switch" aria-checked={activo} onClick={() => toggleCentro(c.id)} disabled={guardando}
                      className="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-60"
                      style={{ backgroundColor: activo ? '#0369A1' : '#CBD5E1' }}>
                      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                        style={{ transform: activo ? 'translateX(20px)' : 'translateX(0)' }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
