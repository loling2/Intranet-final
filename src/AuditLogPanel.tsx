import { useState, useEffect, useCallback } from 'react';
import { Shield, Search, RefreshCw, User, Car, FileText, Key, AlertTriangle, Clock, Activity } from 'lucide-react';
import { supabase, AuditLog } from './supabaseClient';
import { useSociety } from './context/SocietyContext';

const EVENT_ICONS: Record<string, { Icon: React.FC<{ size?: number }>; color: string; bg: string }> = {
  user_invited:         { Icon: User,         color: '#2563EB', bg: '#EFF6FF' },
  user_role_changed:    { Icon: Shield,        color: '#7C3AED', bg: '#F5F3FF' },
  user_activated:       { Icon: User,          color: '#16A34A', bg: '#F0FDF4' },
  user_deactivated:     { Icon: User,          color: '#DC2626', bg: '#FEF2F2' },
  password_reset:       { Icon: Key,           color: '#D97706', bg: '#FFFBEB' },
  vehicle_checkin:      { Icon: Car,           color: '#16A34A', bg: '#F0FDF4' },
  vehicle_checkout:     { Icon: Car,           color: '#0EA5E9', bg: '#F0F9FF' },
  vehicle_forced_release: { Icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' },
  document_uploaded:    { Icon: FileText,      color: '#0EA5E9', bg: '#F0F9FF' },
  document_deleted:     { Icon: FileText,      color: '#DC2626', bg: '#FEF2F2' },
};

const DEFAULT_ICON = { Icon: Activity, color: '#64748B', bg: '#F8FAFC' };

export default function AuditLogPanel() {
  const { activeSocietyId } = useSociety();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEvento, setFilterEvento] = useState('');
  const [filterAll, setFilterAll] = useState(true); // show all societies

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!filterAll) {
      q = q.eq('society_id', activeSocietyId);
    }

    const { data } = await q;
    setLogs((data ?? []) as AuditLog[]);
    setLoading(false);
  }, [activeSocietyId, filterAll]);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter((l) => {
    const matchSearch = !search || l.descripcion.toLowerCase().includes(search.toLowerCase()) || l.autor_email.toLowerCase().includes(search.toLowerCase());
    const matchEvento = !filterEvento || l.evento === filterEvento;
    return matchSearch && matchEvento;
  });

  const uniqueEventos = [...new Set(logs.map((l) => l.evento))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Registro de Auditoria</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{logs.length} eventos registrados</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
          style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar eventos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
        </div>
        <select
          value={filterEvento}
          onChange={(e) => setFilterEvento(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
        >
          <option value="">Todos los eventos</option>
          {uniqueEventos.map((e) => (
            <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button
          onClick={() => setFilterAll(!filterAll)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all duration-200"
          style={{ backgroundColor: filterAll ? '#0F172A' : '#F8FAFC', color: filterAll ? '#FFFFFF' : '#64748B', border: '1px solid #E2E8F0' }}
        >
          {filterAll ? 'Todas las sociedades' : 'Sociedad activa'}
        </button>
      </div>

      {/* Log list */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Activity size={32} style={{ color: '#E2E8F0' }} />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>No hay eventos registrados</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {filtered.map((log) => {
              const cfg = EVENT_ICONS[log.evento] ?? DEFAULT_ICON;
              const { Icon } = cfg;
              return (
                <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors duration-150">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: cfg.bg }}>
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium" style={{ color: '#1E293B' }}>{log.descripcion}</p>
                      <span className="text-xs flex-shrink-0 flex items-center gap-1" style={{ color: '#94A3B8' }}>
                        <Clock size={11} />
                        {new Date(log.created_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: '#94A3B8' }}>
                        Por: <span className="font-medium" style={{ color: '#64748B' }}>{log.autor_nombre || log.autor_email}</span>
                      </span>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {log.evento.replace(/_/g, ' ')}
                      </span>
                      {log.society_id && (
                        <span className="text-xs" style={{ color: '#CBD5E1' }}>{log.society_id}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
