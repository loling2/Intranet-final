import { useState, useEffect, useCallback } from 'react';
import { UserCog, RefreshCw, X, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';

type SupervisorOption = { id: string; nombre: string; email: string };

export default function CoordinadorSupervisoresSection({ coordinadorId }: { coordinadorId: string }) {
  const [asignados, setAsignados] = useState<SupervisorOption[]>([]);
  const [disponibles, setDisponibles] = useState<SupervisorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: rows, error: rowsErr }, { data: sups, error: supsErr }] = await Promise.all([
        supabase
          .from('coordinador_supervisores')
          .select('supervisor_id, supervisor:user_profiles!supervisor_id(id, nombre, email)')
          .eq('coordinador_id', coordinadorId),
        supabase
          .from('user_profiles')
          .select('id, nombre, email')
          .eq('role', 'supervisor')
          .eq('activo', true)
          .order('nombre'),
      ]);
      if (rowsErr) throw rowsErr;
      if (supsErr) throw supsErr;

      const asignadosList = ((rows ?? []) as unknown as { supervisor: SupervisorOption | null }[])
        .filter((r) => r.supervisor)
        .map((r) => r.supervisor as SupervisorOption);
      const asignadosIds = new Set(asignadosList.map((s) => s.id));
      setAsignados(asignadosList);
      setDisponibles(((sups ?? []) as SupervisorOption[]).filter((s) => !asignadosIds.has(s.id)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar supervisores');
    } finally {
      setLoading(false);
    }
  }, [coordinadorId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (supervisorId: string) => {
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('coordinador_supervisores')
        .insert({ coordinador_id: coordinadorId, supervisor_id: supervisorId });
      if (err) throw err;
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar supervisor');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (supervisorId: string) => {
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('coordinador_supervisores')
        .delete()
        .eq('coordinador_id', coordinadorId)
        .eq('supervisor_id', supervisorId);
      if (err) throw err;
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al quitar supervisor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 pb-5">
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #99F6E4', backgroundColor: '#F0FDFA' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #CCFBF1' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#CCFBF1', color: '#0F766E' }}>
            <UserCog size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#0F766E' }}>Supervisores que revisa este coordinador</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: '#1E293B' }}>
              {asignados.length} supervisor{asignados.length !== 1 ? 'es' : ''} asignado{asignados.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw size={16} className="animate-spin" style={{ color: '#0F766E' }} />
          </div>
        ) : (
          <div className="px-4 py-3 space-y-3">
            <div className="space-y-2">
              {asignados.length === 0 && (
                <p className="text-xs text-center py-3" style={{ color: '#94A3B8' }}>No hay supervisores asignados</p>
              )}
              {asignados.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{s.nombre}</p>
                    <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{s.email}</p>
                  </div>
                  <button onClick={() => handleRemove(s.id)} disabled={saving}
                    className="p-1.5 rounded-lg cursor-pointer disabled:opacity-50 hover:bg-red-50"
                    aria-label={`Quitar a ${s.nombre}`}>
                    <X size={14} style={{ color: '#DC2626' }} />
                  </button>
                </div>
              ))}
            </div>

            {disponibles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Añadir supervisor</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {disponibles.map((s) => (
                    <button key={s.id} onClick={() => handleAdd(s.id)} disabled={saving}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left cursor-pointer disabled:opacity-50 transition-colors duration-150 hover:bg-white"
                      style={{ border: '1px dashed #5EEAD4' }}>
                      <Plus size={14} style={{ color: '#0F766E' }} />
                      <span className="text-sm truncate" style={{ color: '#1E293B' }}>{s.nombre}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
