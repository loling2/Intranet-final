import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Mail, Phone, MapPin, Briefcase, Building2, AlertCircle, RefreshCw, Clock, X, ChevronRight } from 'lucide-react';
import { supabase, Empleado } from '../supabaseClient';

type Centro = { id: string; nombre: string };

export default function SupervisorEmpleados() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fichajesModal, setFichajesModal] = useState<{ emp: Empleado; rows: FichajeRow[]; loading: boolean } | null>(null);

  type FichajeRow = {
    id: string;
    fecha: string;
    timestamp: string;
    timestamp_corregido: string | null;
    tipo_evento: string;
    nota_correccion: string | null;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Sin sesión activa'); return; }

      // Get empleado IDs via the helper function (manual + centros)
      const { data: empIds, error: rpcErr } = await supabase
        .rpc('get_supervisor_empleados', { p_supervisor_id: user.id });
      if (rpcErr) throw rpcErr;

      const ids = ((empIds ?? []) as { empleado_id: string }[]).map((r) => r.empleado_id);
      if (ids.length === 0) {
        setEmpleados([]);
        setCentros([]);
        return;
      }

      // Fetch employee details
      const { data: emps, error: empErr } = await supabase
        .from('empleados')
        .select('*')
        .in('id', ids)
        .order('nombre');
      if (empErr) throw empErr;
      setEmpleados((emps ?? []) as Empleado[]);

      // Fetch assigned centros
      const { data: centrosData, error: centrosErr } = await supabase
        .from('supervisor_centros')
        .select('centro_id, centros(id, nombre)')
        .eq('supervisor_id', user.id);
      if (centrosErr) throw centrosErr;
      const centrosList = ((centrosData ?? []) as { centro_id: string; centros: { id: string; nombre: string } | null }[])
        .filter((r) => r.centros)
        .map((r) => ({ id: r.centros!.id, nombre: r.centros!.nombre }));
      setCentros(centrosList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openFichajes = useCallback(async (emp: Empleado) => {
    setFichajesModal({ emp, rows: [], loading: true });
    try {
      const { data, error: fErr } = await supabase
        .from('fichajes')
        .select('id, fecha, timestamp, timestamp_corregido, tipo_evento, nota_correccion')
        .eq('empleado_id', emp.id)
        .order('timestamp', { ascending: false })
        .limit(100);
      if (fErr) throw fErr;
      setFichajesModal({ emp, rows: (data ?? []) as FichajeRow[], loading: false });
    } catch (e: unknown) {
      setFichajesModal({ emp, rows: [], loading: false });
      console.error('Error loading fichajes:', e);
    }
  }, []);

  const filtered = empleados.filter((emp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (emp.nombre + ' ' + (emp.apellidos ?? '')).toLowerCase().includes(q) ||
      (emp.dni ?? '').toLowerCase().includes(q) ||
      (emp.puesto ?? '').toLowerCase().includes(q) ||
      (emp.centro_trabajo ?? '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin" style={{ color: '#7C3AED' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
        <AlertCircle size={32} className="mx-auto mb-3" style={{ color: '#DC2626' }} />
        <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
        <button onClick={loadData} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
          style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: '#0F172A' }}>Mis Empleados Asignados</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{empleados.length} empleado{empleados.length !== 1 ? 's' : ''} bajo tu supervisión</p>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input type="text" placeholder="Buscar por nombre, DNI, puesto..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC', width: '260px' }} />
          </div>
        </div>
      </div>

      {/* Centros asignados */}
      {centros.length > 0 && (
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={16} style={{ color: '#7C3AED' }} />
            <h4 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Mis Centros Asignados</h4>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>{centros.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {centros.map((c) => (
              <span key={c.id} className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE' }}>
                {c.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Employee list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <Users size={40} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>
            {empleados.length === 0 ? 'No tienes empleados asignados' : 'No se encontraron resultados'}
          </p>
          {empleados.length === 0 && (
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Contacta con RRHH para que te asignen empleados o centros</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {filtered.map((emp, i) => {
            const isExpanded = expandedId === emp.id;
            const fullName = emp.nombre + (emp.apellidos ? ` ${emp.apellidos}` : '');
            return (
              <div key={emp.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <button onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                  className="w-full px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors duration-150 hover:bg-slate-50 text-left">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: emp.activo ? '#EFF6FF' : '#FEF2F2', color: emp.activo ? '#0369A1' : '#DC2626' }}>
                    {emp.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{fullName}</p>
                    <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                      {emp.puesto || 'Sin puesto'}{emp.centro_trabajo ? ` · ${emp.centro_trabajo}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!emp.activo && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>Inactivo</span>
                    )}
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                      {isExpanded ? 'Ocultar' : 'Ver detalle'}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-6 pb-5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      {[
                        { icon: Mail, label: 'Email', value: emp.email },
                        { icon: Phone, label: 'Teléfono', value: emp.telefono },
                        { icon: Briefcase, label: 'Puesto', value: emp.puesto },
                        { icon: Building2, label: 'Centro', value: emp.centro_trabajo },
                        { icon: MapPin, label: 'Localidad', value: emp.localidad },
                        { icon: Users, label: 'DNI', value: emp.dni },
                      ].filter((f) => f.value).map((f, j) => {
                        const Icon = f.icon;
                        return (
                          <div key={j} className="flex items-start gap-2.5 p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <Icon size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#7C3AED' }} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{f.label}</p>
                              <p className="text-sm mt-0.5 break-words" style={{ color: '#1E293B' }}>{f.value}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => openFichajes(emp)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                      style={{ backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                      <Clock size={14} />
                      Ver fichajes del empleado
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fichajes modal */}
      {fichajesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setFichajesModal(null)}>
          <div className="rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-auto" style={{ backgroundColor: '#FFFFFF' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between sticky top-0" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div className="flex items-center gap-2">
                <Clock size={18} style={{ color: '#7C3AED' }} />
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Fichajes de {fichajesModal.emp.nombre}</h3>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{fichajesModal.emp.puesto || 'Sin puesto'}{fichajesModal.emp.centro_trabajo ? ` · ${fichajesModal.emp.centro_trabajo}` : ''}</p>
                </div>
              </div>
              <button onClick={() => setFichajesModal(null)} className="p-1.5 rounded-lg cursor-pointer hover:bg-slate-100">
                <X size={18} style={{ color: '#64748B' }} />
              </button>
            </div>
            <div className="p-4">
              {fichajesModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={20} className="animate-spin" style={{ color: '#7C3AED' }} />
                </div>
              ) : fichajesModal.rows.length === 0 ? (
                <div className="text-center py-12">
                  <Clock size={32} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
                  <p className="text-sm" style={{ color: '#64748B' }}>Sin fichajes registrados</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead style={{ backgroundColor: '#F8FAFC' }}>
                    <tr>
                      <th className="px-3 py-2 font-semibold" style={{ color: '#64748B' }}>Fecha</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: '#64748B' }}>Hora</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: '#64748B' }}>Tipo</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: '#64748B' }}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fichajesModal.rows.map((row) => {
                      const eff = row.timestamp_corregido ?? row.timestamp;
                      const tipoLabels: Record<string, { label: string; color: string }> = {
                        entrada: { label: 'Entrada', color: '#16A34A' },
                        salida: { label: 'Salida', color: '#DC2626' },
                        pausa_inicio: { label: 'Descanso', color: '#D97706' },
                        pausa_fin: { label: 'Fin descanso', color: '#0369A1' },
                      };
                      const tc = tipoLabels[row.tipo_evento] ?? { label: row.tipo_evento, color: '#64748B' };
                      return (
                        <tr key={row.id} className="border-t" style={{ borderColor: '#F1F5F9' }}>
                          <td className="px-3 py-2">{row.fecha}</td>
                          <td className="px-3 py-2 font-medium">
                            {new Date(eff).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            {row.timestamp_corregido && (
                              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>corregido</span>
                            )}
                          </td>
                          <td className="px-3 py-2"><span style={{ color: tc.color, fontWeight: 600 }}>{tc.label}</span></td>
                          <td className="px-3 py-2" style={{ color: '#94A3B8' }}>{row.nota_correccion ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
