import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Mail, Phone, MapPin, Briefcase, Building2, AlertCircle, RefreshCw, Clock, X, ChevronRight, Send, FileText, KeyRound, CheckCircle2 } from 'lucide-react';
import { supabase, Empleado } from '../supabaseClient';

type Centro = { id: string; nombre: string };

interface EmailPlantilla { id: string; nombre: string; asunto: string; activo: boolean; }
interface EmailCuenta { id: string; nombre: string; email: string; activo: boolean; }

function generateRandomPassword(length = 12): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = lower + upper + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pwd = [pick(upper), pick(lower), pick(digits), pick(symbols)].join('');
  for (let i = pwd.length; i < length; i++) pwd += pick(all);
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

export default function SupervisorEmpleados() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fichajesModal, setFichajesModal] = useState<{ emp: Empleado; rows: FichajeRow[]; loading: boolean } | null>(null);
  const [sendEmailEmp, setSendEmailEmp] = useState<Empleado | null>(null);

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

      const { data: empIds, error: rpcErr } = await supabase
        .rpc('get_supervisor_empleados', { p_supervisor_id: user.id });
      if (rpcErr) throw rpcErr;

      const ids = ((empIds ?? []) as { empleado_id: string }[]).map((r) => r.empleado_id);
      if (ids.length === 0) {
        setEmpleados([]);
        setCentros([]);
        return;
      }

      const { data: emps, error: empErr } = await supabase
        .from('empleados')
        .select('*')
        .in('id', ids)
        .order('nombre');
      if (empErr) throw empErr;
      setEmpleados((emps ?? []) as Empleado[]);

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
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openFichajes(emp)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                        style={{ backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                        <Clock size={14} />
                        Ver fichajes del empleado
                        <ChevronRight size={12} />
                      </button>
                      {emp.email && (
                        <button
                          onClick={() => setSendEmailEmp(emp)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                          style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                          <Send size={14} />
                          Enviar correo de acceso
                        </button>
                      )}
                    </div>
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

      {/* Send access email modal */}
      {sendEmailEmp && (
        <SendAccessEmailModal emp={sendEmailEmp} onClose={() => setSendEmailEmp(null)} />
      )}
    </div>
  );
}

// ─── Send Access Email Modal (for supervisors) ──────────────────────────────

function SendAccessEmailModal({ emp, onClose }: { emp: Empleado; onClose: () => void }) {
  const [plantillas, setPlantillas] = useState<EmailPlantilla[]>([]);
  const [cuentas, setCuentas] = useState<EmailCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [plantillaId, setPlantillaId] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('email_plantillas').select('id, nombre, asunto, activo').eq('activo', true).order('nombre'),
      supabase.from('email_cuentas').select('id, nombre, email, activo').eq('activo', true).order('nombre'),
    ]).then(([{ data: p }, { data: c }]) => {
      setPlantillas((p ?? []) as EmailPlantilla[]);
      setCuentas((c ?? []) as EmailCuenta[]);
      setLoading(false);
    });
  }, []);

  const handleSend = async () => {
    if (!plantillaId) { setError('Selecciona una plantilla'); return; }
    if (!cuentaId) { setError('Selecciona una cuenta SMTP'); return; }
    if (!emp.email) { setError('El empleado no tiene correo'); return; }
    setSending(true); setError('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

      let finalPassword = password;
      if (autoPassword) {
        finalPassword = generateRandomPassword();
      }

      // Send the email first
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            plantilla_id: plantillaId,
            cuenta_id: cuentaId,
            to_email: emp.email,
            variables: {
              nombre: emp.nombre,
              email: emp.email,
              password: finalPassword || '(ver con tu administrador)',
              url_acceso: window.location.origin,
              empresa: empresa || 'la empresa',
            },
          }),
        }
      );
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error ?? `Error ${resp.status}`);

      // Set the password on the user's account (if they have one)
      if ((autoPassword || password) && emp.user_id) {
        const pwdResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ action: 'set_password', userId: emp.user_id, password: finalPassword }),
          }
        );
        const pwdBody = await pwdResp.json().catch(() => ({}));
        if (!pwdResp.ok) throw new Error(pwdBody.error ?? 'Error al asignar la contrasena');
      }

      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar el correo');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <Send size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Enviar correo de acceso</h2>
              <p className="text-white/60 text-xs truncate max-w-[220px]">{emp.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="flex flex-col items-center py-4 text-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ECFDF5', border: '2px solid #6EE7B7' }}>
                <CheckCircle2 size={28} style={{ color: '#065F46' }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: '#065F46' }}>Correo enviado correctamente</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>El correo ha sido enviado a {emp.email}</p>
              <button onClick={onClose} className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                Cerrar
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Plantilla *</label>
                {plantillas.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <FileText size={13} />
                    No hay plantillas activas. Crealas en Email - Plantillas.
                  </div>
                ) : (
                  <select value={plantillaId} onChange={(e) => { setPlantillaId(e.target.value); setError(''); }}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                    style={{ border: `1.5px solid ${!plantillaId && error ? '#FECACA' : '#E2E8F0'}`, backgroundColor: '#F8FAFC', color: plantillaId ? '#1E293B' : '#94A3B8' }}>
                    <option value="">Selecciona una plantilla...</option>
                    {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Cuenta SMTP emisora *</label>
                {cuentas.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <Mail size={13} />
                    No hay cuentas SMTP activas. Configuralas en Email - Cuentas SMTP.
                  </div>
                ) : (
                  <select value={cuentaId} onChange={(e) => { setCuentaId(e.target.value); setError(''); }}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                    style={{ border: `1.5px solid ${!cuentaId && error ? '#FECACA' : '#E2E8F0'}`, backgroundColor: '#F8FAFC', color: cuentaId ? '#1E293B' : '#94A3B8' }}>
                    <option value="">Selecciona una cuenta...</option>
                    {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-semibold mb-1.5 uppercase tracking-wider cursor-pointer" style={{ color: '#64748B' }}>
                  <input
                    type="checkbox"
                    checked={autoPassword}
                    onChange={(e) => setAutoPassword(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: '#0369A1' }}
                  />
                  Generar contrasena aleatoria automaticamente
                </label>
                {autoPassword ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0369A1' }}>
                    <KeyRound size={13} />
                    Se generara una contrasena aleatoria y se asignara al usuario al enviar el correo.
                  </div>
                ) : (
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contrasena temporal del usuario"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Nombre de empresa <span className="normal-case font-normal" style={{ color: '#94A3B8' }}>(variable {`{{empresa}}`})</span>
                </label>
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Nombre de la empresa"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <AlertCircle size={13} style={{ color: '#DC2626' }} />
                  <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !plantillaId || !cuentaId}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#0F172A' }}
                >
                  {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  Enviar correo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
