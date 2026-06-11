import { useState, useEffect } from 'react';
import { Monitor, Smartphone, Laptop, Headphones, Tablet, Phone, Settings, RefreshCw } from 'lucide-react';
import { supabase } from './supabaseClient';
import type { Dispositivo } from './supabaseClient';
import type { SocietyTheme } from './themes';

interface Props {
  theme: SocietyTheme;
}

const typeIcons: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Portatil: Laptop,
  Sobremesa: Settings,
  Monitor: Monitor,
  Movil: Smartphone,
  Periferico: Headphones,
  Tablet: Tablet,
  VoIP: Phone,
};

export default function DevicesCard({ theme }: Props) {
  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  (async () => {
    setLoading(true);
    
    // 1. Obtener el usuario autenticado (Auth)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // 2. CONSULTA INTERMEDIA: Buscamos el ID del empleado usando el ID de Auth o su Email
      // Nota: Ajusta 'empleados' por el nombre exacto de tu tabla de perfiles si se llama distinto (ej: 'profiles')
      const { data: empleadoData, error: empleadoError } = await supabase
        .from('empleados') 
        .select('id')
        .or(`id.eq.${user.id},email.eq.${user.email}`)
        .single();

      // Guardamos el ID correcto (ya sea el encontrado en la tabla o el de auth como plan de respaldo)
      const realEmpleadoId = empleadoData?.id || user.id;

      // 3. CONSULTA FINAL: Traemos los dispositivos usando el ID real del empleado obtenido
      const { data, error } = await supabase
        .from('dispositivos')
        .select('*')
        .eq('empleado_id', realEmpleadoId)
        .order('fecha_asignacion', { ascending: true });

      if (!error && data) {
        setDevices(data as Dispositivo[]);
      } else {
        setDevices([]);
      }
    } else {
      setDevices([]);
    }
    
    setLoading(false);
  })();
}, []);

  const activeCount = devices.filter((d) => d.estado_id === 1).length;
  const isActive = device.estado_id === 1;
const isInactive = device.estado_id === 2;
const isStock = device.estado_id === 3;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-500"
      style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
    >
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme.primary}12` }}>
            <Laptop size={20} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>Mis Dispositivos</h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {loading ? '...' : `${activeCount} activo${activeCount !== 1 ? 's' : ''} de ${devices.length}`}
            </p>
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-4">
          <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: `${theme.primary}0A` }}>
            <p className="text-lg font-bold" style={{ color: theme.primary }}>{loading ? '—' : activeCount}</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>Activos</p>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: '#FEF2F2' }}>
            <p className="text-lg font-bold" style={{ color: '#DC2626' }}>{loading ? '—' : devices.length - activeCount}</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>Inactivos</p>
          </div>
        </div>
      </div>

      {/* Device list */}
      <div className="px-6 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : devices.length === 0 ? (
          <div className="py-6 text-center">
            <Laptop size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
            <p className="text-xs" style={{ color: theme.textSecondary }}>Sin dispositivos asignados</p>
          </div>
        ) : (
          devices.map((device) => {
            const Icon = typeIcons[device.tipo] ?? Laptop;
            return (
              <div
                key={device.id}
                className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor:
  isActive ? theme.primaryLight :
  isInactive ? '#FEF2F2' :
  '#FEF9C3',

border: `1px solid ${
  isActive ? theme.border :
  isInactive ? '#FECACA' :
  '#FDE047'
}`,
                }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor:
  isActive ? `${theme.primary}15` :
  isInactive ? '#FEE2E2' :
  '#FEF3C7'}}>
                  <Icon size={16} style={{ color: device.activo ? theme.primary : '#DC2626' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>
                    {device.marca_modelo}
                  </p>
                  <p className="text-xs truncate" style={{ color: theme.textSecondary }}>
                    {device.tipo}{device.numero_serie ? ` · ${device.numero_serie}` : ''}
                  </p>
                  {device.caracteristicas && (
                    <p className="text-xs truncate mt-0.5" style={{ color: theme.textSecondary, opacity: 0.7 }}>
                      {device.caracteristicas}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{
                    backgroundColor:
  isActive ? '#22C55E' :
  isInactive ? '#EF4444' :
  '#EAB308',
                    boxShadow: device.activo ? '0 0 6px #22C55E80' : '0 0 6px #EF444480',
                  }} />
                  <span className="text-xs font-medium">
  {isActive
    ? 'Activo'
    : isInactive
    ? 'Inactivo'
    : 'Stock'}
</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {devices.length > 0 && (
        <div className="px-6 py-3 text-center" style={{ borderTop: `1px solid ${theme.border}` }}>
          <p className="text-xs" style={{ color: theme.textSecondary }}>
            {devices[0]?.fecha_asignacion
              ? `Asignados desde ${new Date(devices[0].fecha_asignacion).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`
              : 'Dispositivos asignados por IT'}
          </p>
        </div>
      )}
    </div>
  );
}