import { useState, useEffect, useCallback } from 'react';
import { UserCheck, Search, RefreshCw, Calendar, Moon, Star, Plus, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface SustitucionRow {
  id: string;
  baja_id: string | null;
  sustituto_id: string;
  sustituto_nombre: string;
  fecha_inicio: string;
  num_dias: number;
  num_horas: number;
  tipo_cobertura: string | null;
  turno: string | null;
  es_festivo: boolean;
  horas_nocturnas: number | null;
  num_dias_festivos: number | null;
  unidad: string;
  notas: string | null;
  empleado_nombre: string;
}

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
}

const turnoColors: Record<string, { color: string; bg: string }> = {
  'mañana': { color: '#D97706', bg: '#FFFBEB' },
  tarde:    { color: '#EA580C', bg: '#FFF7ED' },
  noche:    { color: '#7C3AED', bg: '#F5F3FF' },
};

export default function SustitucionesModule() {
  const [rows, setRows] = useState<SustitucionRow[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');

  // New sustitución form
  const [showForm, setShowForm] = useState(false);
  const [sustitutoSearch, setSustitutoSearch] = useState('');
  const [form, setForm] = useState({ sustituto_id: '', sustituto_nombre: '', num_horas: 0, motivo: '', fecha: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sData }, { data: bData }, { data: empData }] = await Promise.all([
      supabase.from('sustituciones').select('*').order('fecha_inicio', { ascending: false }).limit(1000),
      supabase.from('bajas_temporales').select('id, empleado_nombre'),
      supabase.from('empleados').select('id, nombre, dni').order('nombre', { ascending: true }),
    ]);
    const bMap = new Map((bData ?? []).map((b) => [b.id as string, b.empleado_nombre as string]));
    setEmpleados(empData ?? []);
    setRows(
      (sData ?? []).map((s) => ({
        ...s,
        baja_id: s.baja_id ?? null,
        empleado_nombre: s.baja_id ? (bMap.get(s.baja_id) ?? '—') : 'Sustitución directa',
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.sustituto_nombre.toLowerCase().includes(q) && !s.empleado_nombre.toLowerCase().includes(q)) return false;
    }
    if (filterTipo && s.tipo_cobertura !== filterTipo) return false;
    if (filterDesde && s.fecha_inicio < filterDesde) return false;
    if (filterHasta && s.fecha_inicio > filterHasta) return false;
    return true;
  });

  const totalDias = filtered.filter((s) => s.unidad !== 'horas').reduce((acc, s) => acc + (s.num_dias || 0), 0);
  const totalHoras = filtered.filter((s) => s.unidad === 'horas').reduce((acc, s) => acc + (s.num_horas || 0), 0);
  const totalNocturnas = filtered.reduce((acc, s) => acc + (s.horas_nocturnas || 0), 0);
  const sustitutosUnicos = new Set(filtered.map((s) => s.sustituto_id)).size;

  const filteredSustitutos = empleados.filter((e) =>
    e.nombre.toLowerCase().includes(sustitutoSearch.toLowerCase()) &&
    e.id !== form.sustituto_id
  );

  const handleSelectSustituto = (emp: Empleado) => {
    setForm({ ...form, sustituto_id: emp.id, sustituto_nombre: emp.nombre });
    setSustitutoSearch('');
  };

  const handleSave = async () => {
    if (!form.sustituto_id) { setFormError('Selecciona un sustituto.'); return; }
    if (!form.num_horas || form.num_horas <= 0) { setFormError('Indica el número de horas.'); return; }
    if (!form.fecha) { setFormError('Selecciona la fecha.'); return; }
    setSaving(true); setFormError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const row = {
        baja_id: null,
        sustituto_id: form.sustituto_id,
        sustituto_nombre: form.sustituto_nombre,
        fecha_inicio: form.fecha,
        num_dias: 0,
        num_horas: form.num_horas,
        tipo_cobertura: 'pagar',
        turno: null,
        es_festivo: false,
        unidad: 'horas',
        notas: form.motivo.trim() || null,
        horas_nocturnas: 0,
        num_dias_festivos: 0,
        motivo_otro: null,
        created_by: userId,
      };
      const { error } = await supabase.from('sustituciones').insert(row);
      if (error) throw error;
      setShowForm(false);
      setForm({ sustituto_id: '', sustituto_nombre: '', num_horas: 0, motivo: '', fecha: '' });
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta sustitución?')) return;
    await supabase.from('sustituciones').delete().eq('id', id);
    await load();
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sustitutos únicos', value: sustitutosUnicos, color: '#0369A1', bg: '#EFF6FF' },
          { label: 'Registros', value: filtered.length, color: '#64748B', bg: '#F8FAFC' },
          { label: 'Días cubiertos', value: totalDias, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Horas nocturnas', value: `${totalNocturnas}h`, color: '#7C3AED', bg: '#F5F3FF' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + New button */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text" placeholder="Buscar sustituto o sustituido..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
        </div>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
          <option value="">Todos los tipos</option>
          <option value="pagar">Pagar</option>
          <option value="compensar">Compensar</option>
          <option value="otro">Otro</option>
        </select>
        <div className="flex items-center gap-1.5">
          <Calendar size={13} style={{ color: '#94A3B8' }} />
          <input type="date" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)}
            className="px-2 py-2 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }} />
          <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
          <input type="date" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)}
            className="px-2 py-2 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }} />
        </div>
        <button onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer hover:opacity-70 transition-opacity"
          style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
          <RefreshCw size={13} />
        </button>
        <button onClick={() => { setShowForm(true); setForm({ sustituto_id: '', sustituto_nombre: '', num_horas: 0, motivo: '', fecha: new Date().toISOString().slice(0, 10) }); setFormError(''); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
          style={{ backgroundColor: '#0369A1' }}>
          <Plus size={13} /> Nueva Sustitución
        </button>
      </div>

      {/* New sustitución form */}
      {showForm && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #BFDBFE' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#EFF6FF' }}>
            <div className="flex items-center gap-2">
              <UserCheck size={14} style={{ color: '#0369A1' }} />
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Nueva Sustitución (directa)</h3>
            </div>
            <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FFFFFF', color: '#64748B' }}>
              <X size={14} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {/* Sustituto picker */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Sustituto *</label>
              {form.sustituto_id ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#0369A1', color: '#fff' }}>
                    {form.sustituto_nombre.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium flex-1" style={{ color: '#1E293B' }}>{form.sustituto_nombre}</span>
                  <button onClick={() => setForm({ ...form, sustituto_id: '', sustituto_nombre: '' })} className="text-xs cursor-pointer" style={{ color: '#64748B' }}>Cambiar</button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input type="text" value={sustitutoSearch}
                    onChange={(e) => setSustitutoSearch(e.target.value)}
                    placeholder="Buscar trabajador..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
                  {sustitutoSearch && (
                    <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg" style={{ border: '1px solid #E2E8F0' }}>
                      {filteredSustitutos.slice(0, 8).map((emp) => (
                        <button key={emp.id} onClick={() => handleSelectSustituto(emp)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                          style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                            {emp.nombre.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium" style={{ color: '#1E293B' }}>{emp.nombre}</span>
                          {emp.dni && <span className="text-xs" style={{ color: '#94A3B8' }}>{emp.dni}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Horas *</label>
                <input type="number" min={0} step={0.5} value={form.num_horas || ''}
                  onChange={(e) => setForm({ ...form, num_horas: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', color: '#0369A1', fontWeight: 700 }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Fecha *</label>
                <input type="date" value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ borderColor: '#E2E8F0', color: '#1E293B' }} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Motivo</label>
              <input type="text" value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                placeholder="Ej. Refuerzo de limpieza"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ borderColor: '#E2E8F0', color: '#1E293B' }} />
            </div>

            {formError && <p className="text-xs" style={{ color: '#DC2626' }}>{formError}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0369A1' }}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Guardando...' : 'Añadir al balance de sustitutos'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <UserCheck size={14} style={{ color: '#0369A1' }} />
          <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Registro de Sustituciones</h3>
          <span className="ml-auto text-xs" style={{ color: '#94A3B8' }}>{filtered.length} registros</span>
          {totalHoras > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
              +{totalHoras}h en horas
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw size={18} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <UserCheck size={28} style={{ color: '#E2E8F0' }} />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>No hay sustituciones con los filtros aplicados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '880px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Sustituto', 'Persona sustituida', 'Fecha', 'Cantidad', 'Retribución', 'Turno', 'Extras', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                {filtered.map((s) => {
                  const tc = s.turno ? turnoColors[s.turno] : null;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
                            {s.sustituto_nombre.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold" style={{ color: '#1E293B' }}>{s.sustituto_nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#475569' }}>{s.empleado_nombre}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{s.fecha_inicio}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold" style={{ color: '#0369A1' }}>
                          {s.unidad === 'horas' ? `${s.num_horas}h` : `${s.num_dias}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.tipo_cobertura ? (
                          <span className="text-xs px-2 py-0.5 rounded font-semibold capitalize" style={{
                            backgroundColor: s.tipo_cobertura === 'pagar' ? '#F0FDF4' : s.tipo_cobertura === 'compensar' ? '#EFF6FF' : '#FFFBEB',
                            color: s.tipo_cobertura === 'pagar' ? '#16A34A' : s.tipo_cobertura === 'compensar' ? '#0369A1' : '#D97706',
                          }}>
                            {s.tipo_cobertura}
                          </span>
                        ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {tc && s.turno ? (
                          <span className="text-xs px-2 py-0.5 rounded font-semibold capitalize"
                            style={{ backgroundColor: tc.bg, color: tc.color }}>{s.turno}</span>
                        ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(s.horas_nocturnas ?? 0) > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-1"
                              style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
                              <Moon size={10} />{s.horas_nocturnas}h
                            </span>
                          )}
                          {s.es_festivo && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-1"
                              style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                              <Star size={10} />{s.num_dias_festivos}d
                            </span>
                          )}
                          {s.notas && (
                            <span className="text-xs truncate max-w-[100px]" style={{ color: '#94A3B8' }} title={s.notas}>{s.notas}</span>
                          )}
                          {!(s.horas_nocturnas ?? 0) && !s.es_festivo && !s.notas && (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {!s.baja_id && (
                          <button onClick={() => handleDelete(s.id)}
                            className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-red-50"
                            style={{ color: '#DC2626' }}>
                            <X size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
