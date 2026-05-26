import { useState, useEffect, useCallback } from 'react';
import { Ligature as FileSignature, Clock, Bell, Search, Filter, Upload, X, RefreshCw, AlertCircle, CheckCircle2, FileText, Download } from 'lucide-react';
import { supabase, type Empleado, type EstadoContrato, type HistorialContrato, type Sociedad } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { uploadToWasabi } from '../lib/wasabi';
import { writeAuditLog } from '../lib/auditLog';

interface Props {
  currentUserRole: 'admin' | 'rrhh';
}

const ESTADOS: { value: EstadoContrato; label: string; color: string; bg: string; border: string; Icon: React.FC<{ size?: number }> }[] = [
  { value: 'pendiente', label: 'Pendiente', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', Icon: Clock },
  { value: 'avisado',   label: 'Avisado',   color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE', Icon: Bell },
  { value: 'firmado',   label: 'Firmado',   color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', Icon: FileSignature },
];

interface EmpleadoConHistorial extends Empleado {
  sociedad_nombre?: string;
  historial?: HistorialContrato[];
}

interface UploadContratoModal {
  empleado: EmpleadoConHistorial;
}

function UploadContratoModal({ empleado, onClose, onUploaded }: UploadContratoModal & { onClose: () => void; onUploaded: () => void }) {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file || !profile) return;
    setLoading(true);
    setError('');
    try {
      const dni = empleado.dni?.toUpperCase().replace(/\s/g, '') ?? 'SIN_DNI';
      const ext = file.name.split('.').pop() ?? 'pdf';
      const nombre = `Contrato-${dni}.${ext}`;
      const wasabiKey = `publico/${Date.now()}-${nombre}`;
      await uploadToWasabi(file, wasabiKey);
      const { error: dbErr } = await supabase.from('documents').insert({
        nombre_archivo: nombre,
        tipo: file.type || 'application/pdf',
        folder: 'publico',
        usuario_destino_id: empleado.user_id ?? null,
        usuario_destino_email: empleado.email ?? '',
        society_id: empleado.id_sociedad,
        subido_por: profile.id,
        subido_por_nombre: profile.nombre,
        tamano_bytes: file.size,
        indexeddb_key: `contrato_${Date.now()}`,
        wasabi_key: wasabiKey,
      });
      if (dbErr) throw dbErr;
      await writeAuditLog({
        evento: 'contrato_uploaded',
        descripcion: `Contrato firmado subido para ${empleado.nombre} (${dni})`,
        autor: profile,
        entidad: 'document',
        metadata: { empleado_id: empleado.id, nombre_archivo: nombre, wasabi_key: wasabiKey },
        society_id: empleado.id_sociedad,
      });
      onUploaded();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #14532D, #16A34A)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Upload size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Subir contrato firmado</h2>
              <p className="text-white/70 text-xs">{empleado.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={13} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <p className="text-xs" style={{ color: '#16A34A' }}>
              El archivo se guardara como <strong>Contrato-{empleado.dni ?? 'SIN_DNI'}.pdf</strong> en la carpeta Publico y sera visible para el empleado.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Archivo del contrato</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs px-3 py-2.5 rounded-xl outline-none cursor-pointer"
              style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#16A34A' }}
            >
              {loading ? <><RefreshCw size={13} className="animate-spin" /> Subiendo...</> : <><Upload size={13} /> Subir contrato</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContratosModule({ currentUserRole }: Props) {
  const [empleados, setEmpleados] = useState<EmpleadoConHistorial[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSociedad, setFilterSociedad] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoContrato | ''>('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historialMap, setHistorialMap] = useState<Record<string, HistorialContrato[]>>({});
  const [loadingHistorial, setLoadingHistorial] = useState<string | null>(null);
  const [uploadModal, setUploadModal] = useState<EmpleadoConHistorial | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  void currentUserRole;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, socRes] = await Promise.all([
        supabase.from('empleados').select('*').order('nombre'),
        supabase.from('sociedades').select('*').order('nombre'),
      ]);
      const socs = (socRes.data ?? []) as Sociedad[];
      setSociedades(socs);
      const emps: EmpleadoConHistorial[] = ((empRes.data ?? []) as Empleado[]).map((e) => ({
        ...e,
        sociedad_nombre: socs.find((s) => s.id === e.id_sociedad)?.nombre ?? '',
      }));
      setEmpleados(emps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHistorial = async (empleadoId: string) => {
    if (historialMap[empleadoId]) return;
    setLoadingHistorial(empleadoId);
    const { data } = await supabase.from('historial_contrato').select('*').eq('empleado_id', empleadoId).order('created_at', { ascending: false });
    setHistorialMap((prev) => ({ ...prev, [empleadoId]: (data ?? []) as HistorialContrato[] }));
    setLoadingHistorial(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadHistorial(id);
    }
  };

  const filtered = empleados.filter((e) => {
    if (filterSociedad && e.id_sociedad !== filterSociedad) return false;
    if (filterEstado && (e.estado_contrato ?? 'pendiente') !== filterEstado) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.nombre.toLowerCase().includes(q) || (e.dni ?? '').toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    pendiente: empleados.filter((e) => (e.estado_contrato ?? 'pendiente') === 'pendiente').length,
    avisado: empleados.filter((e) => e.estado_contrato === 'avisado').length,
    firmado: empleados.filter((e) => e.estado_contrato === 'firmado').length,
  };

  return (
    <div className="space-y-6">
      {uploadModal && (
        <UploadContratoModal
          empleado={uploadModal}
          onClose={() => setUploadModal(null)}
          onUploaded={() => { setUploadSuccess(true); setTimeout(() => setUploadSuccess(false), 3000); loadData(); }}
        />
      )}

      {uploadSuccess && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}>
          <CheckCircle2 size={16} />
          <span>Contrato subido correctamente y disponible para el empleado</span>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-3 gap-4">
        {ESTADOS.map(({ value, label, color, bg, border, Icon }) => (
          <button
            key={value}
            onClick={() => setFilterEstado(filterEstado === value ? '' : value)}
            className="rounded-xl p-4 text-left transition-all duration-200 cursor-pointer hover:opacity-90"
            style={{
              backgroundColor: filterEstado === value ? bg : '#FFFFFF',
              border: `1.5px solid ${filterEstado === value ? border : '#E2E8F0'}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} style={{ color }} />
              <p className="text-2xl font-bold" style={{ color }}>{counts[value]}</p>
            </div>
            <p className="text-xs font-semibold" style={{ color }}>{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar nombre, DNI, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={13} style={{ color: '#94A3B8' }} />
          <select
            value={filterSociedad}
            onChange={(e) => setFilterSociedad(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          >
            <option value="">Todas las sociedades</option>
            {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value as EstadoContrato | '')}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <FileSignature size={16} style={{ color: '#0369A1' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Trazabilidad de Contratos</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1" style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
              {filtered.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
            <span className="text-sm" style={{ color: '#94A3B8' }}>Cargando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <FileSignature size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>No se encontraron empleados</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {filtered.map((emp) => {
              const estado = ESTADOS.find((e) => e.value === (emp.estado_contrato ?? 'pendiente'))!;
              const isExpanded = expandedId === emp.id;
              const historial = historialMap[emp.id] ?? [];
              return (
                <div key={emp.id}>
                  <div
                    className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                    onClick={() => toggleExpand(emp.id)}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: estado.bg, color: estado.color }}>
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {emp.dni && <p className="text-xs font-mono" style={{ color: '#64748B' }}>{emp.dni}</p>}
                        {emp.sociedad_nombre && <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.sociedad_nombre}</p>}
                        {emp.tipo_contrato && <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.tipo_contrato}</p>}
                      </div>
                    </div>

                    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: estado.bg, color: estado.color, border: `1px solid ${estado.border}` }}>
                      <estado.Icon size={12} />
                      {estado.label}
                    </span>

                    {emp.estado_contrato === 'firmado' && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setUploadModal(emp); }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 cursor-pointer transition-all duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                        title="Subir archivo de contrato firmado"
                      >
                        <Upload size={12} />
                        Subir contrato
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-4 pt-2" style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#64748B' }}>
                        Historial de cambios
                      </p>
                      {loadingHistorial === emp.id ? (
                        <div className="flex items-center gap-2 py-4">
                          <RefreshCw size={13} className="animate-spin" style={{ color: '#94A3B8' }} />
                          <span className="text-xs" style={{ color: '#94A3B8' }}>Cargando historial...</span>
                        </div>
                      ) : historial.length === 0 ? (
                        <p className="text-xs py-3" style={{ color: '#94A3B8' }}>Sin cambios registrados — estado inicial: Pendiente</p>
                      ) : (
                        <div className="space-y-2">
                          {historial.map((h) => {
                            const estadoNew = ESTADOS.find((e) => e.value === h.estado_nuevo);
                            return (
                              <div key={h.id} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{ backgroundColor: estadoNew?.bg ?? '#F8FAFC' }}>
                                  {estadoNew && <estadoNew.Icon size={11} style={{ color: estadoNew.color }} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold" style={{ color: '#1E293B' }}>
                                    {h.estado_anterior} → {h.estado_nuevo}
                                  </p>
                                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{h.justificacion}</p>
                                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                                    {h.cambiado_por_nombre} · {new Date(h.created_at).toLocaleString('es-ES')}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Contratos subidos */}
                      <ContratosDocs empleadoId={emp.id} empleadoEmail={emp.email} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ContratosDocs({ empleadoId, empleadoEmail }: { empleadoId: string; empleadoEmail: string }) {
  const [docs, setDocs] = useState<{ id: string; nombre_archivo: string; wasabi_key: string | null; fecha_subida: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('documents')
        .select('id, nombre_archivo, wasabi_key, fecha_subida')
        .eq('folder', 'publico')
        .ilike('nombre_archivo', 'Contrato-%')
        .or(`usuario_destino_email.eq.${empleadoEmail},usuario_destino_id.eq.${empleadoId}`)
        .order('fecha_subida', { ascending: false });
      setDocs((data ?? []) as typeof docs);
    })();
  }, [empleadoId, empleadoEmail]);

  if (docs.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Contratos subidos</p>
      <div className="space-y-1.5">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #BBF7D0' }}>
            <FileText size={13} style={{ color: '#16A34A' }} />
            <p className="text-xs flex-1 truncate font-medium" style={{ color: '#1E293B' }}>{d.nombre_archivo}</p>
            <p className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>{new Date(d.fecha_subida).toLocaleDateString('es-ES')}</p>
            {d.wasabi_key && (
              <a
                href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wasabi-download?key=${encodeURIComponent(d.wasabi_key)}`}
                download={d.nombre_archivo}
                className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={11} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
