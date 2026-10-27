import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Circle, FileText, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface CalidadDoc {
  id: string;
  nombre_archivo: string;
  es_general: boolean;
  anio: string;
  mes: string;
}

interface DownloadStatus {
  empleado_id: string;
  nombre: string;
  email: string | null;
  society_nombre: string | null;
  downloaded: boolean;
  downloaded_at: string | null;
}

interface Props {
  docs: CalidadDoc[];
}

const monthNames: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatDate(value: string | null): string {
  if (!value) return 'Pendiente';
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CalidadDownloadsPanel({ docs }: Props) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<DownloadStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const selectedDoc = docs.find(doc => doc.id === selectedDocId) ?? null;
  const downloadedCount = statuses.filter(status => status.downloaded).length;
  const pendingCount = statuses.length - downloadedCount;
  const percentage = statuses.length > 0 ? Math.round((downloadedCount / statuses.length) * 100) : 0;

  const sortedDocs = useMemo(
    () => [...docs].sort((a, b) => `${b.anio}-${b.mes}`.localeCompare(`${a.anio}-${a.mes}`)),
    [docs],
  );

  useEffect(() => {
    if (!selectedDocId && sortedDocs[0]) setSelectedDocId(sortedDocs[0].id);
  }, [selectedDocId, sortedDocs]);

  useEffect(() => {
    if (!selectedDocId) {
      setStatuses([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    supabase.rpc('get_calidad_document_trazabilidad', { p_document_id: selectedDocId })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) throw rpcError;
        setStatuses((data as DownloadStatus[]) ?? []);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          console.error('Error loading calidad download tracking:', cause);
          setStatuses([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedDocId]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#1E293B' }}>Descargados</h2>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Consulta quién ha descargado cada documento y quién lo tiene pendiente.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
          <BarChart3 size={16} />
          <span className="text-xs font-semibold">Seguimiento por documento</span>
        </div>
      </div>

      {sortedDocs.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <FileText size={28} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>Todavía no hay documentos de Calidad</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)]">
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} style={{ color: '#0369A1' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#1E293B' }}>Documentos</h3>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{sortedDocs.length}</span>
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {sortedDocs.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className="w-full text-left p-3 rounded-xl transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedDocId === doc.id ? '#EFF6FF' : '#F8FAFC',
                    border: `1px solid ${selectedDocId === doc.id ? '#93C5FD' : '#E2E8F0'}`,
                  }}
                >
                  <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{doc.nombre_archivo}</p>
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                    {doc.es_general ? 'General' : 'Por sociedad'} · {monthNames[doc.mes] ?? doc.mes} {doc.anio}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            {selectedDoc && (
              <>
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#0369A1' }}>Resumen de descargas</p>
                    <h3 className="text-base font-semibold mt-1 truncate" style={{ color: '#1E293B' }}>{selectedDoc.nombre_archivo}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedDocId(selectedDoc.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
                    title="Actualizar"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12" style={{ color: '#94A3B8' }}><RefreshCw size={20} className="animate-spin" /></div>
                ) : error ? (
                  <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>No se pudo cargar el seguimiento de este documento.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="rounded-xl p-3" style={{ backgroundColor: '#EFF6FF' }}>
                        <p className="text-2xl font-semibold" style={{ color: '#0369A1' }}>{percentage}%</p>
                        <p className="text-xs mt-1" style={{ color: '#475569' }}>Descargado</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ backgroundColor: '#F0FDF4' }}>
                        <p className="text-2xl font-semibold" style={{ color: '#15803D' }}>{downloadedCount}</p>
                        <p className="text-xs mt-1" style={{ color: '#475569' }}>Descargados</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ backgroundColor: '#FFF7ED' }}>
                        <p className="text-2xl font-semibold" style={{ color: '#C2410C' }}>{pendingCount}</p>
                        <p className="text-xs mt-1" style={{ color: '#475569' }}>Pendientes</p>
                      </div>
                    </div>

                    <div className="mb-5">
                      <div className="flex items-center justify-between text-xs mb-2" style={{ color: '#64748B' }}>
                        <span>Progreso de descarga</span><span>{downloadedCount} de {statuses.length}</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: '#0369A1' }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Users size={15} style={{ color: '#64748B' }} />
                      <h4 className="text-sm font-semibold" style={{ color: '#1E293B' }}>Estado por empleado</h4>
                    </div>
                    {statuses.length === 0 ? (
                      <p className="text-sm py-6 text-center" style={{ color: '#94A3B8' }}>No hay empleados destinatarios para este documento.</p>
                    ) : (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto">
                        {statuses.map(status => (
                          <div key={status.empleado_id} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: status.downloaded ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${status.downloaded ? '#BBF7D0' : '#FED7AA'}` }}>
                            {status.downloaded ? <CheckCircle2 size={17} style={{ color: '#16A34A' }} /> : <Circle size={17} style={{ color: '#EA580C' }} />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{status.nombre}</p>
                              <p className="text-xs truncate" style={{ color: '#64748B' }}>{status.society_nombre ?? status.email ?? 'Sin sociedad'}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-semibold" style={{ color: status.downloaded ? '#15803D' : '#C2410C' }}>{status.downloaded ? 'Descargado' : 'Pendiente'}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>{formatDate(status.downloaded_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
