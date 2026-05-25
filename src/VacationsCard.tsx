import { Palmtree, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { SocietyTheme } from './themes';
import { VacationBalance, VacationRequest } from './mockData';

interface Props {
  balance: VacationBalance;
  requests: VacationRequest[];
  theme: SocietyTheme;
}

const statusConfig = {
  aprobada: { label: 'Aprobada', icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  pendiente: { label: 'Pendiente', icon: Clock, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  rechazada: { label: 'Rechazada', icon: XCircle, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

export default function VacationsCard({ balance, requests, theme }: Props) {
  const available = balance.total - balance.used - balance.pending;
  const usedPct = (balance.used / balance.total) * 100;
  const pendingPct = (balance.pending / balance.total) * 100;

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
            <Palmtree size={20} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
              Mis Vacaciones
            </h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {available} dias disponibles
            </p>
          </div>
        </div>
        <button
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer"
          style={{
            color: '#FFFFFF',
            backgroundColor: theme.primary,
          }}
        >
          Solicitar
        </button>
      </div>

      {/* Counter Cards */}
      <div className="px-6 pt-5 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <div
            className="rounded-xl p-3 text-center"
            style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
          >
            <p className="text-xl font-bold" style={{ color: '#16A34A' }}>
              {balance.used}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#15803D' }}>
              Usados
            </p>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}
          >
            <p className="text-xl font-bold" style={{ color: theme.primary }}>
              {available}
            </p>
            <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
              Disponibles
            </p>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}
          >
            <p className="text-xl font-bold" style={{ color: '#D97706' }}>
              {balance.pending}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
              Pendientes
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: theme.textSecondary }}>
            <span>{balance.used} usados</span>
            <span>{balance.total} total</span>
          </div>
          <div
            className="h-2.5 rounded-full overflow-hidden flex"
            style={{ backgroundColor: `${theme.primary}10` }}
          >
            <div
              className="h-full rounded-l-full transition-all duration-700"
              style={{ width: `${usedPct}%`, backgroundColor: '#22C55E' }}
            />
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${pendingPct}%`, backgroundColor: '#F59E0B' }}
            />
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs" style={{ color: theme.textSecondary }}>Usados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs" style={{ color: theme.textSecondary }}>Pendientes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `${theme.primary}20` }} />
              <span className="text-xs" style={{ color: theme.textSecondary }}>Disponibles</span>
            </div>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div
        className="px-6 py-3"
        style={{ borderTop: `1px solid ${theme.border}` }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textSecondary }}>
          Solicitudes recientes
        </p>
        <div className="space-y-2">
          {requests.map((req) => {
            const cfg = statusConfig[req.status];
            const StatusIcon = cfg.icon;
            return (
              <div
                key={req.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  backgroundColor: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${cfg.color}15` }}
                >
                  <StatusIcon size={14} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: theme.textPrimary }}>
                    {req.from} - {req.to}
                  </p>
                  <p className="text-xs" style={{ color: theme.textSecondary }}>
                    {req.days} dias &middot; {req.reason}
                  </p>
                </div>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0"
                  style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
