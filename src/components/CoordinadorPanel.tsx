import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, LogOut, UserCog, Building2, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

type Centro = { id: string; nombre: string };
type EmpleadoResumen = { id: string; nombre: string; apellidos: string | null; puesto: string | null; centro_trabajo: string | null; activo: boolean };
type SupervisorPanel = { id: string; nombre: string; email: string; centros: Centro[]; empleados: EmpleadoResumen[] };

export default function CoordinadorPanel({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [supervisores, setSupervisores] = useState<SupervisorPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_coordinador_panel');
      if (rpcErr) throw rpcErr;
      if (!Array.isArray(data)) throw new Error('Respuesta inesperada del servidor');
      setSupervisores(data as SupervisorPanel[]);
    } catch (e: unknown) {
      setSupervisores([]);
      setError(e instanceof Error ? e.message : 'Error al cargar supervisores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <header className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#0F766E' }}>Coordinador</p>
          <p className="text-sm" style={{ color: '#64748B' }}>{email}</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
          style={{ backgroundColor: '#F8FAFC', color: '#334155', border: '1px solid #E2E8F0' }}>
          <LogOut size={14} /> Salir
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#0F172A' }}>Supervisores a tu cargo</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>Consulta los centros y empleados de cada supervisor. Esta vista es de solo lectura.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin" style={{ color: '#0F766E' }} />
          </div>
        ) : error ? (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <AlertCircle size={28} className="mx-auto mb-2" style={{ color: '#DC2626' }} />
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
            <button onClick={load} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}>Reintentar</button>
          </div>
        ) : supervisores.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <UserCog size={40} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>No tienes supervisores asignados</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Contacta con RRHH para que te asignen supervisores</p>
          </div>
        ) : (
          supervisores.map((sup) => {
            const isOpen = openId === sup.id;
            return (
              <div key={sup.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <button onClick={() => setOpenId(isOpen ? null : sup.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left cursor-pointer hover:bg-slate-50 transition-colors duration-150">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{sup.nombre}</p>
                    <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{sup.email}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                    {sup.centros.length} centro{sup.centros.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F0FDFA', color: '#0F766E' }}>
                    {sup.empleados.length} empleado{sup.empleados.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <div className="pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: '#2563EB' }}>
                        <Building2 size={12} /> Centros
                      </p>
                      {sup.centros.length === 0 ? (
                        <p className="text-xs" style={{ color: '#94A3B8' }}>Sin centros asignados</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {sup.centros.map((c) => (
                            <span key={c.id} className="text-xs font-medium px-2.5 py-1 rounded-lg"
                              style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>{c.nombre}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: '#0F766E' }}>
                        <Users size={12} /> Empleados
                      </p>
                      {sup.empleados.length === 0 ? (
                        <p className="text-xs" style={{ color: '#94A3B8' }}>Sin empleados en su alcance</p>
                      ) : (
                        <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                          {sup.empleados.map((e) => (
                            <div key={e.id} className="py-2 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>
                                  {e.nombre}{e.apellidos ? ` ${e.apellidos}` : ''}
                                </p>
                                <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                                  {e.puesto || 'Sin puesto'}{e.centro_trabajo ? ` · ${e.centro_trabajo}` : ''}
                                </p>
                              </div>
                              {!e.activo && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>Inactivo</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
