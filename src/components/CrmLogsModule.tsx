import { useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, ClipboardList, Loader2, User } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface CrmLog {
  id: string;
  evento: string;
  descripcion: string;
  autor_nombre: string;
  autor_email: string;
  entidad_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function eventLabel(evento: string): string {
  return evento === 'residente_deleted' ? 'Borrado' : 'Cambio de estado';
}

function eventStyle(evento: string): { backgroundColor: string; color: string } {
  return evento === 'residente_deleted'
    ? { backgroundColor: '#FEF2F2', color: '#B91C1C' }
    : { backgroundColor: '#EFF6FF', color: '#0369A1' };
}

export default function CrmLogsModule() {
  const [logs, setLogs] = useState<CrmLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.rpc('get_crm_residente_logs').then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) {
        setError('No se pudieron cargar los registros.');
        setLogs([]);
      } else {
        setError('');
        setLogs((data ?? []) as CrmLog[]);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Logs de residentes</h2>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Registro de borrados y cambios de estado del CRM.</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm" style={{ color: '#64748B' }}>
          <Loader2 size={18} className="animate-spin" style={{ color: '#0369A1' }} /> Cargando registros...
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <ClipboardList size={32} style={{ color: '#CBD5E1' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: '#475569' }}>Todavía no hay registros</p>
        </div>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="hidden md:grid grid-cols-[1fr_1.2fr_1fr_1fr] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
            <span>Acción</span><span>Residente</span><span>Realizado por</span><span>Fecha</span>
          </div>
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {logs.map((log) => {
              const style = eventStyle(log.evento);
              const residentName = typeof log.metadata?.residente_nombre === 'string' ? log.metadata.residente_nombre : 'Residente';
              return (
                <div key={log.id} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_1fr_1fr] gap-3 md:gap-4 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold" style={style}>{eventLabel(log.evento)}</span>
                    <span className="md:hidden text-xs" style={{ color: '#64748B' }}>{formatDate(log.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <User size={14} style={{ color: '#0369A1' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#0F172A' }}>{residentName}</p>
                      {log.entidad_id && <p className="text-xs truncate" style={{ color: '#94A3B8' }}>ID: {log.entidad_id}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
                    <span className="md:hidden text-xs font-medium" style={{ color: '#94A3B8' }}>Por:</span>
                    <span>{log.autor_nombre || log.autor_email}</span>
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-sm" style={{ color: '#64748B' }}>
                    <CalendarClock size={14} /> {formatDate(log.created_at)}
                  </div>
                  <p className="md:col-span-4 text-xs" style={{ color: '#94A3B8' }}>{log.descripcion}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
