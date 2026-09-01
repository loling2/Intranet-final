import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, LogIn, Clock, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Pagination, paginate, totalPages as calcTotalPages } from './Pagination';
import { supabase } from '../supabaseClient';

interface AccessLog {
  id: string;
  user_id: string;
  user_email: string;
  user_nombre: string | null;
  user_role: string | null;
  ip_address: string | null;
  device_info: string | null;
  user_agent: string | null;
  session_id: string | null;
  created_at: string;
}

function getDeviceIcon(info: string | null) {
  if (!info) return Monitor;
  if (/Móvil|Mobile/i.test(info)) return Smartphone;
  if (/Tablet/i.test(info)) return Tablet;
  return Monitor;
}

export default function AccessLogsPanel() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filterDate) {
      const start = new Date(filterDate);
      const end = new Date(filterDate);
      end.setDate(end.getDate() + 1);
      q = q.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
    }

    const { data } = await q;
    setLogs((data ?? []) as AccessLog[]);
    setLoading(false);
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterUser, filterDate]);

  const filtered = logs.filter((l) => {
    const matchSearch = !search
      || l.user_email.toLowerCase().includes(search.toLowerCase())
      || (l.user_nombre ?? '').toLowerCase().includes(search.toLowerCase());
    const matchUser = !filterUser
      || l.user_email === filterUser
      || (l.user_nombre ?? '') === filterUser;
    return matchSearch && matchUser;
  });

  const uniqueUsers = [...new Set(logs.map((l) => l.user_nombre || l.user_email))].sort();

  const PAGE_SIZE = 25;
  const totalPages = calcTotalPages(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const pagedLogs = paginate(filtered, safePage, PAGE_SIZE);

  const formatDate = (iso: string) => new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Historial de Accesos</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {logs.length} accesos registrados
          </p>
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
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
        </div>
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
        >
          <option value="">Todos los usuarios</option>
          {uniqueUsers.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
        />
        {(search || filterUser || filterDate) && (
          <button
            onClick={() => { setSearch(''); setFilterUser(''); setFilterDate(''); }}
            className="px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer"
            style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Log list */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <LogIn size={32} style={{ color: '#E2E8F0' }} />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>No hay accesos registrados</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {pagedLogs.map((log) => {
              const DeviceIcon = getDeviceIcon(log.device_info);
              return (
                <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors duration-150">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#F0F9FF' }}>
                    <DeviceIcon size={16} style={{ color: '#0EA5E9' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>
                          {log.user_nombre || log.user_email}
                        </p>
                        <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{log.user_email}</p>
                      </div>
                      <span className="text-xs flex-shrink-0 flex items-center gap-1" style={{ color: '#94A3B8' }}>
                        <Clock size={11} />
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {log.user_role && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                          {log.user_role}
                        </span>
                      )}
                      {log.device_info && (
                        <span className="text-xs" style={{ color: '#64748B' }}>{log.device_info}</span>
                      )}
                      {log.ip_address && (
                        <span className="text-xs" style={{ color: '#94A3B8' }}>IP: {log.ip_address}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <Pagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
