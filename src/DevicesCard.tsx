import { Monitor, Smartphone, Laptop, Headphones, Tablet, Phone } from 'lucide-react';
import { SocietyTheme } from './themes';
import { Device } from './mockData';

interface Props {
  devices: Device[];
  theme: SocietyTheme;
}

const typeIcons: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Portatil: Laptop,
  Monitor: Monitor,
  Movil: Smartphone,
  Periferico: Headphones,
  Tablet: Tablet,
  VoIP: Phone,
};

export default function DevicesCard({ devices, theme }: Props) {
  const activeCount = devices.filter((d) => d.active).length;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-500"
      style={{
        backgroundColor: theme.bgCard,
        border: `1px solid ${theme.border}`,
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${theme.primary}12` }}
          >
            <Laptop size={20} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
              Mis Dispositivos
            </h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {activeCount} activos de {devices.length}
            </p>
          </div>
        </div>
        <button
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer"
          style={{
            color: theme.primary,
            backgroundColor: theme.primaryLight,
          }}
        >
          Gestionar
        </button>
      </div>

      {/* Status Summary Bar */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-4">
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ backgroundColor: `${theme.primary}0A` }}
          >
            <p className="text-lg font-bold" style={{ color: theme.primary }}>
              {activeCount}
            </p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              Activos
            </p>
          </div>
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ backgroundColor: '#FEE2E20A' }}
          >
            <p className="text-lg font-bold" style={{ color: '#DC2626' }}>
              {devices.length - activeCount}
            </p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              Inactivos
            </p>
          </div>
        </div>
      </div>

      {/* Device List */}
      <div className="px-6 py-3 space-y-2">
        {devices.map((device) => {
          const Icon = typeIcons[device.type] ?? Laptop;
          return (
            <div
              key={device.id}
              className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200"
              style={{
                backgroundColor: device.active ? `${theme.primaryLight}` : '#FEF2F2',
                border: `1px solid ${device.active ? theme.border : '#FECACA'}`,
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: device.active ? `${theme.primary}15` : '#FEE2E2',
                }}
              >
                <Icon
                  size={16}
                  style={{ color: device.active ? theme.primary : '#DC2626' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: theme.textPrimary }}
                >
                  {device.name}
                </p>
                <p className="text-xs" style={{ color: theme.textSecondary }}>
                  {device.type} &middot; {device.serial}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: device.active ? '#22C55E' : '#EF4444',
                    boxShadow: device.active
                      ? '0 0 6px #22C55E80'
                      : '0 0 6px #EF444480',
                  }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: device.active ? '#16A34A' : '#DC2626' }}
                >
                  {device.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-3 text-center"
        style={{ borderTop: `1px solid ${theme.border}` }}
      >
        <p className="text-xs" style={{ color: theme.textSecondary }}>
          Asignados desde {devices[0]?.assignedDate ?? 'N/A'}
        </p>
      </div>
    </div>
  );
}
