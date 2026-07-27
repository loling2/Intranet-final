import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Mail, Phone, MapPin, Briefcase, Building2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase, Empleado } from '../supabaseClient';

export default function SupervisorEmpleados() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Sin sesión activa'); return; }

      const { data: asigData, error: asigErr } = await supabase
        .from('supervisor_asignaciones')
        .select('empleado_id')
        .eq('supervisor_id', user.id);
      if (asigErr) throw asigErr;

      const ids = (asigData ?? []).map((r: { empleado_id: string }) => r.empleado_id);
      if (ids.length === 0) { setEmpleados([]); return; }

      const { data: emps, error: empErr } = await supabase
        .from('empleados')
        .select('*')
        .in('id', ids)
        .order('nombre');
      if (empErr) throw empErr;
      setEmpleados((emps ?? []) as Empleado[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
        <RefreshCw size={24} className="animate-spin" style={{ color: '#0369A1' }} />
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

      {/* Employee list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <Users size={40} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>
            {empleados.length === 0 ? 'No tienes empleados asignados' : 'No se encontraron resultados'}
          </p>
          {empleados.length === 0 && (
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Contacta con RRHH para que te asignen empleados</p>
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
                  <div className="px-6 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                          <Icon size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#0369A1' }} />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{f.label}</p>
                            <p className="text-sm mt-0.5 break-words" style={{ color: '#1E293B' }}>{f.value}</p>
                          </div>
                        </div>
                      );
                    })}
                    {emp.observaciones && (
                      <div className="flex items-start gap-2.5 p-3 rounded-lg sm:col-span-2 lg:col-span-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#D97706' }} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D97706' }}>Observaciones</p>
                          <p className="text-sm mt-0.5 break-words" style={{ color: '#1E293B' }}>{emp.observaciones}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
