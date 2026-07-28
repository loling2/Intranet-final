import { useState, useEffect, useCallback } from 'react';
import { UserCheck, Search, RefreshCw, Calendar, Moon, Star, Plus, X, Pencil, Trash2, CheckCircle2, Sun, Sunset, CheckSquare, Square, Banknote, CreditCard, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface BajaInfo {
  id: string;
  empleado_nombre: string;
  estado: string;
  tipo_absentismo: string | null;
  reposo_duracion: string | null;
  total_dias: number;
  larga_duracion: boolean | null;
  descontado: boolean | null;
}

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
  unidad_festivo: string | null;
  horas_festivas: number | null;
  es_nocturno: boolean | null;
  notas: string | null;
  motivo_otro: string | null;
  dias_a_descontar: number | null;
  tiene_justificante: boolean | null;
  finalizado: boolean | null;
  horas_liquidadas: boolean;
  dias_descontados: boolean;
  descripcion_descuento: string | null;
  empleado_nombre: string;
  baja: BajaInfo | null;
}

function computeBajaDiasDescontar(b: BajaInfo | null): number | null {
  if (!b) return null;
  if (b.estado !== 'activa') return null;
  if (b.descontado) return null;
  if (b.tipo_absentismo !== 'PNR' && b.tipo_absentismo !== 'Reposo') return null;
  const diasReposo = b.reposo_duracion === '72h' ? 3 : b.reposo_duracion === '48h' ? 2 : 1;
  return b.tipo_absentismo === 'Reposo' ? diasReposo : (b.larga_duracion ? 1 : (b.total_dias ?? 1));
}

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
}

const HORAS_POR_TURNO: Record<string, number> = { mañana: 8, tarde: 8, noche: 8 };

interface EditForm {
  sustituto_nombre: string;
  fecha_inicio: string;
  unidad: 'dias' | 'horas';
  num_dias: number;
  num_horas: number;
  tipo_cobertura: string;
  turno: string;
  es_festivo: boolean;
  unidad_festivo: 'dias' | 'horas';
  num_dias_festivos: number;
  horas_festivas: number;
  es_nocturno: boolean;
  horas_nocturnas: number;
  motivo_otro: string;
  notas: string;
  dias_a_descontar: number | null;
  tiene_justificante: boolean;
}

function computeHoras(s: { unidad: string; num_horas: number; num_dias: number; turno: string | null }): number {
  if (s.unidad === 'horas') return s.num_horas || 0;
  return s.num_dias * (HORAS_POR_TURNO[s.turno ?? ''] ?? 8);
}

function festivoLabel(s: SustitucionRow): string {
  if (!s.es_festivo) return '—';
  if (s.unidad_festivo === 'horas') return `${s.horas_festivas ?? 0}h`;
  return `${s.num_dias_festivos ?? 0}d`;
}

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
  const [form, setForm] = useState({ sustituto_id: '', sustituto_nombre: '', num_horas: 0, motivo: '', fecha: '', dias_a_descontar: '', tiene_justificante: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit state
  const [editingRow, setEditingRow] = useState<SustitucionRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [liquidaciones, setLiquidaciones] = useState<{ sustituto_id: string; horas_liquidadas: number }[]>([]);

  // Unified finalizar modal
  const [finalizarTarget, setFinalizarTarget] = useState<SustitucionRow | null>(null);
  const [liquidarHoras, setLiquidarHoras] = useState(0);
  const [liquidarNotas, setLiquidarNotas] = useState('');
  const [savingLiquidar, setSavingLiquidar] = useState(false);
  const [descontarDesc, setDescontarDesc] = useState('');
  const [savingDescontar, setSavingDescontar] = useState(false);
  // local done flags (reset when modal opens)
  const [horasHechas, setHorasHechas] = useState(false);
  const [diasHechos, setDiasHechos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sData }, { data: bData }, { data: empData }, { data: liqData }] = await Promise.all([
      supabase.from('sustituciones').select('*').order('fecha_inicio', { ascending: false }).limit(1000),
      supabase.from('bajas_temporales').select('id, empleado_nombre, estado, tipo_absentismo, reposo_duracion, total_dias, larga_duracion, descontado'),
      supabase.from('empleados').select('id, nombre, dni').order('nombre', { ascending: true }),
      supabase.from('liquidaciones_horas').select('sustituto_id, horas_liquidadas'),
    ]);
    setLiquidaciones((liqData ?? []) as { sustituto_id: string; horas_liquidadas: number }[]);
    const bMap = new Map((bData ?? []).map((b) => [b.id as string, b as unknown as BajaInfo]));
    setEmpleados(empData ?? []);
    setRows(
      (sData ?? []).map((s) => {
        const baja = s.baja_id ? (bMap.get(s.baja_id) ?? null) : null;
        return {
          ...s,
          baja_id: s.baja_id ?? null,
          dias_a_descontar: s.dias_a_descontar ?? null,
          horas_liquidadas: s.horas_liquidadas ?? false,
          dias_descontados: s.dias_descontados ?? false,
          descripcion_descuento: s.descripcion_descuento ?? null,
          tiene_justificante: s.tiene_justificante ?? false,
          empleado_nombre: baja ? (baja.empleado_nombre ?? '—') : 'Sustitución directa',
          baja,
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build map of liquidadas hours per sustituto
  const liquidadasPorSustituto = new Map<string, number>();
  for (const l of liquidaciones) {
    liquidadasPorSustituto.set(l.sustituto_id, (liquidadasPorSustituto.get(l.sustituto_id) ?? 0) + l.horas_liquidadas);
  }
  // Compute total paid horas per sustituto from active rows
  const horasPagadasPorSustituto = new Map<string, number>();
  for (const s of rows) {
    if (s.tipo_cobertura === 'pagar') {
      horasPagadasPorSustituto.set(s.sustituto_id, (horasPagadasPorSustituto.get(s.sustituto_id) ?? 0) + computeHoras(s));
    }
  }

  const filtered = rows.filter((s) => {
    if (s.finalizado) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.sustituto_nombre.toLowerCase().includes(q) && !s.empleado_nombre.toLowerCase().includes(q)) return false;
    }
    if (filterTipo && s.tipo_cobertura !== filterTipo) return false;
    if (filterDesde && s.fecha_inicio < filterDesde) return false;
    if (filterHasta && s.fecha_inicio > filterHasta) return false;
    return true;
  });

  const totalHorasPagar = filtered.filter((s) => s.tipo_cobertura === 'pagar').reduce((acc, s) => acc + computeHoras(s), 0);
  const totalHorasCompensar = filtered.filter((s) => s.tipo_cobertura === 'compensar').reduce((acc, s) => acc + computeHoras(s), 0);
  const totalDiasDescontar = filtered.reduce((acc, s) => {
    const bajaDesc = computeBajaDiasDescontar(s.baja);
    return acc + (bajaDesc ?? s.dias_a_descontar ?? 0);
  }, 0);
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
        dias_a_descontar: form.dias_a_descontar === '' ? null : Number(form.dias_a_descontar),
        tiene_justificante: form.tiene_justificante,
        created_by: userId,
      };
      const { error } = await supabase.from('sustituciones').insert(row);
      if (error) throw error;
      setShowForm(false);
      setForm({ sustituto_id: '', sustituto_nombre: '', num_horas: 0, motivo: '', fecha: '', dias_a_descontar: '', tiene_justificante: false });
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

  const openEdit = (s: SustitucionRow) => {
    setEditingRow(s);
    setEditError('');
    setEditForm({
      sustituto_nombre: s.sustituto_nombre,
      fecha_inicio: s.fecha_inicio,
      unidad: (s.unidad === 'horas' ? 'horas' : 'dias'),
      num_dias: s.num_dias || 0,
      num_horas: s.num_horas || 0,
      tipo_cobertura: s.tipo_cobertura ?? '',
      turno: s.turno ?? '',
      es_festivo: s.es_festivo ?? false,
      unidad_festivo: (s.unidad_festivo === 'horas' ? 'horas' : 'dias'),
      num_dias_festivos: s.num_dias_festivos ?? 0,
      horas_festivas: s.horas_festivas ?? 0,
      es_nocturno: s.es_nocturno ?? false,
      horas_nocturnas: s.horas_nocturnas ?? 0,
      motivo_otro: s.motivo_otro ?? '',
      notas: s.notas ?? '',
      dias_a_descontar: s.dias_a_descontar,
      tiene_justificante: s.tiene_justificante ?? false,
    });
  };

  const updField = (field: keyof EditForm, value: string | number | boolean | null) =>
    setEditForm((p) => (p ? { ...p, [field]: value } : p));

  const handleSaveEdit = async () => {
    if (!editingRow || !editForm) return;
    if (!editForm.fecha_inicio) { setEditError('La fecha es obligatoria.'); return; }
    setSavingEdit(true); setEditError('');
    try {
      const horasCalculadas = editForm.unidad === 'horas'
        ? editForm.num_horas
        : (editForm.turno ? editForm.num_dias * (HORAS_POR_TURNO[editForm.turno] ?? 8) : editForm.num_horas);
      const { error } = await supabase.from('sustituciones').update({
        sustituto_nombre: editForm.sustituto_nombre.trim(),
        fecha_inicio: editForm.fecha_inicio,
        unidad: editForm.unidad,
        num_dias: editForm.unidad === 'dias' ? editForm.num_dias : 0,
        num_horas: horasCalculadas,
        tipo_cobertura: editForm.tipo_cobertura || null,
        turno: editForm.turno || null,
        es_festivo: editForm.es_festivo,
        unidad_festivo: editForm.unidad_festivo,
        num_dias_festivos: editForm.es_festivo ? (editForm.unidad_festivo === 'dias' ? editForm.num_dias_festivos : 0) : 0,
        horas_festivas: editForm.es_festivo ? (editForm.unidad_festivo === 'horas' ? editForm.horas_festivas : 0) : 0,
        es_nocturno: editForm.es_nocturno,
        horas_nocturnas: editForm.es_nocturno ? editForm.horas_nocturnas : 0,
        motivo_otro: editForm.tipo_cobertura === 'otro' ? (editForm.motivo_otro.trim() || null) : null,
        notas: editForm.notas.trim() || null,
        dias_a_descontar: editForm.dias_a_descontar === null ? null : Number(editForm.dias_a_descontar),
        tiene_justificante: editForm.tiene_justificante,
      }).eq('id', editingRow.id);
      if (error) throw error;
      setEditingRow(null); setEditForm(null);
      await load();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingEdit(false);
    }
  };

  const colStyle = (width: string): React.CSSProperties => ({ minWidth: width, width: width });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sustitutos únicos', value: sustitutosUnicos, color: '#0369A1', bg: '#EFF6FF' },
          { label: 'H. a pagar', value: `${totalHorasPagar}h`, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'H. a compensar', value: `${totalHorasCompensar}h`, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Días a descontar', value: totalDiasDescontar, color: '#DC2626', bg: '#FEF2F2' },
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
        <button onClick={() => { setShowForm(true); setForm({ sustituto_id: '', sustituto_nombre: '', num_horas: 0, motivo: '', fecha: new Date().toISOString().slice(0, 10), dias_a_descontar: '', tiene_justificante: false }); setFormError(''); }}
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Días a descontar (opcional)</label>
                <input type="number" min={0} step={1} value={form.dias_a_descontar}
                  onChange={(e) => setForm({ ...form, dias_a_descontar: e.target.value })}
                  placeholder="—"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 700 }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Justificante (opcional)</label>
                <button onClick={() => setForm({ ...form, tiene_justificante: !form.tiene_justificante })}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm border cursor-pointer transition-all"
                  style={{ borderColor: form.tiene_justificante ? '#BBF7D0' : '#E2E8F0', backgroundColor: form.tiene_justificante ? '#F0FDF4' : '#F8FAFC', color: form.tiene_justificante ? '#16A34A' : '#94A3B8' }}>
                  {form.tiene_justificante ? <CheckSquare size={16} /> : <Square size={16} />}
                  <span className="font-medium">{form.tiene_justificante ? 'Con justificante' : 'Sin justificante'}</span>
                </button>
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

      {/* Excel-like table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <UserCheck size={14} style={{ color: '#0369A1' }} />
          <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Registro de Sustituciones</h3>
          <span className="ml-auto text-xs" style={{ color: '#94A3B8' }}>{filtered.length} registros</span>
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
            <table className="w-full text-sm border-collapse" style={{ minWidth: '1100px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9' }}>
                  {[
                    { label: 'Persona a sustituir', w: '170px' },
                    { label: 'Fecha', w: '90px' },
                    { label: 'Tipo', w: '100px' },
                    { label: 'Días descontar', w: '80px' },
                    { label: 'Justif.', w: '60px' },
                    { label: 'Persona sustituta', w: '170px' },
                    { label: 'H. pagar', w: '70px' },
                    { label: 'H. compensar', w: '75px' },
                    { label: 'H. nocturnidad', w: '85px' },
                    { label: 'H. festivas', w: '80px' },
                    { label: '', w: '70px' },
                  ].map((h) => (
                    <th key={h.label} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide border-b" style={{ color: '#475569', borderColor: '#E2E8F0', ...colStyle(h.w) }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => {
                  const horas = computeHoras(s);
                  const hPagar = s.tipo_cobertura === 'pagar' ? horas : null;
                  const hCompensar = s.tipo_cobertura === 'compensar' ? horas : null;
                  const hNoc = (s.horas_nocturnas ?? 0) > 0 ? s.horas_nocturnas : null;
                  const hFest = s.es_festivo ? (s.unidad_festivo === 'horas' ? (s.horas_festivas ?? 0) : (s.num_dias_festivos ?? 0)) : null;
                  const bajaDiasDesc = computeBajaDiasDescontar(s.baja);
                  const diasDesc = bajaDiasDesc ?? s.dias_a_descontar;
                  const bg = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
                  return (
                    <tr key={s.id} className="hover:bg-blue-50/40 transition-colors" style={{ backgroundColor: bg }}>
                      {/* Persona a sustituir */}
                      <td className="px-3 py-2.5 border-b" style={{ borderColor: '#F1F5F9' }}>
                        <span className="text-xs font-semibold" style={{ color: '#1E293B' }}>{s.empleado_nombre}</span>
                      </td>
                      {/* Fecha */}
                      <td className="px-3 py-2.5 border-b" style={{ borderColor: '#F1F5F9' }}>
                        <span className="text-xs font-mono" style={{ color: '#64748B' }}>{s.fecha_inicio}</span>
                        {s.notas && <p className="text-[10px] mt-0.5 truncate max-w-[84px]" style={{ color: '#94A3B8' }} title={s.notas}>{s.notas}</p>}
                      </td>
                      {/* Tipo cobertura */}
                      <td className="px-3 py-2.5 border-b text-center" style={{ borderColor: '#F1F5F9' }}>
                        {s.tipo_cobertura === 'pagar' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>Pagar</span>}
                        {s.tipo_cobertura === 'compensar' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>Compensar</span>}
                        {s.tipo_cobertura === 'otro' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{s.motivo_otro || 'Otro'}</span>}
                        {!s.tipo_cobertura && <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      {/* Días a descontar */}
                      <td className="px-3 py-2.5 border-b text-center" style={{ borderColor: '#F1F5F9' }}>
                        {diasDesc ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>−{diasDesc}d</span>
                        ) : (
                          <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      {/* Justificante */}
                      <td className="px-3 py-2.5 border-b text-center" style={{ borderColor: '#F1F5F9' }}>
                        <button
                          onClick={async () => {
                            const next = !s.tiene_justificante;
                            await supabase.from('sustituciones').update({ tiene_justificante: next }).eq('id', s.id);
                            setRows((prev) => prev.map((r) => r.id === s.id ? { ...r, tiene_justificante: next } : r));
                          }}
                          className="cursor-pointer hover:opacity-70 transition-opacity"
                          title={s.tiene_justificante ? 'Quitar justificante' : 'Marcar con justificante'}
                        >
                          {s.tiene_justificante ? (
                            <CheckSquare size={15} style={{ color: '#16A34A' }} />
                          ) : (
                            <Square size={15} style={{ color: '#CBD5E1' }} />
                          )}
                        </button>
                      </td>
                      {/* Persona sustituta */}
                      <td className="px-3 py-2.5 border-b" style={{ borderColor: '#F1F5F9' }}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
                            {s.sustituto_nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-medium block" style={{ color: '#1E293B' }}>{s.sustituto_nombre}</span>
                            {s.turno && (
                              <span className="text-[10px] font-semibold capitalize" style={{ color: s.turno === 'noche' ? '#7C3AED' : s.turno === 'tarde' ? '#EA580C' : '#D97706' }}>
                                {s.turno === 'noche' ? '🌙' : s.turno === 'tarde' ? '🌅' : '☀️'} {s.turno}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* H. pagar */}
                      <td className="px-3 py-2.5 border-b text-center" style={{ borderColor: '#F1F5F9' }}>
                        {hPagar !== null ? (
                          <span className="text-xs font-bold" style={{ color: '#16A34A' }}>{hPagar}h</span>
                        ) : (
                          <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      {/* H. compensar */}
                      <td className="px-3 py-2.5 border-b text-center" style={{ borderColor: '#F1F5F9' }}>
                        {hCompensar !== null ? (
                          <span className="text-xs font-bold" style={{ color: '#D97706' }}>{hCompensar}h</span>
                        ) : (
                          <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      {/* H. nocturnidad */}
                      <td className="px-3 py-2.5 border-b text-center" style={{ borderColor: '#F1F5F9' }}>
                        {hNoc !== null ? (
                          <span className="text-xs font-bold flex items-center justify-center gap-0.5" style={{ color: '#7C3AED' }}>
                            <Moon size={10} />{hNoc}h
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      {/* H. festivas */}
                      <td className="px-3 py-2.5 border-b text-center" style={{ borderColor: '#F1F5F9' }}>
                        {hFest !== null ? (
                          <span className="text-xs font-bold flex items-center justify-center gap-0.5" style={{ color: '#854D0E' }}>
                            <Star size={10} />{festivoLabel(s)}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-2.5 border-b" style={{ borderColor: '#F1F5F9' }}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => {
                            const horas = computeHoras(s);
                            const yaLiquidadas = liquidadasPorSustituto.get(s.sustituto_id) ?? 0;
                            const pagadas = horasPagadasPorSustituto.get(s.sustituto_id) ?? 0;
                            const pendiente = Math.max(0, pagadas - yaLiquidadas);
                            const dias = s.dias_a_descontar ?? computeBajaDiasDescontar(s.baja) ?? 0;
                            setFinalizarTarget(s);
                            setLiquidarHoras(pendiente);
                            setLiquidarNotas('');
                            setDescontarDesc('');
                            setHorasHechas(s.horas_liquidadas ?? false);
                            setDiasHechos((s.dias_descontados ?? false) || dias === 0);
                          }}
                            className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-emerald-50"
                            style={{ color: '#16A34A' }} title="Liquidar / descontar">
                            <CheckCircle2 size={12} />
                          </button>
                          <button onClick={() => openEdit(s)}
                            className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-blue-50"
                            style={{ color: '#0369A1' }} title="Editar">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDelete(s.id)}
                            className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-red-50"
                            style={{ color: '#DC2626' }} title="Eliminar">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unified Finalizar modal: liquidar horas + descontar días together */}
      {finalizarTarget && (() => {
        const s = finalizarTarget;
        const horas = computeHoras(s);
        const yaLiquidadas = liquidadasPorSustituto.get(s.sustituto_id) ?? 0;
        const pagadas = horasPagadasPorSustituto.get(s.sustituto_id) ?? 0;
        const pendiente = Math.max(0, pagadas - yaLiquidadas);
        const dias = s.dias_a_descontar ?? computeBajaDiasDescontar(s.baja) ?? 0;
        const hayDias = dias > 0;
        const todoHecho = horasHechas && diasHechos;
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
              <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
                <h2 className="text-white font-semibold text-sm flex items-center gap-2"><CheckCircle2 size={15} /> Finalizar sustitución</h2>
                <button onClick={() => setFinalizarTarget(null)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  <X size={15} />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Info resumen */}
                <div className="rounded-lg px-4 py-3" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <p className="text-sm font-semibold" style={{ color: '#0C4A6E' }}>{s.sustituto_nombre}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#0369A1' }}>
                    {horas}h · {s.empleado_nombre} · {s.fecha_inicio}
                  </p>
                </div>

                {/* Sección 1: Liquidar horas */}
                <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${horasHechas ? '#BBF7D0' : '#FDE68A'}`, backgroundColor: horasHechas ? '#F0FDF4' : '#FFFBEB' }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${horasHechas ? '#BBF7D0' : '#FDE68A'}` }}>
                    <div className="flex items-center gap-2">
                      <Banknote size={14} style={{ color: horasHechas ? '#16A34A' : '#D97706' }} />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: horasHechas ? '#15803D' : '#92400E' }}>Liquidar horas</span>
                    </div>
                    {horasHechas ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: '#16A34A', color: '#fff' }}>
                        <Check size={10} /> Hecho
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold" style={{ color: '#D97706' }}>{pendiente}h pendientes</span>
                    )}
                  </div>
                  {!horasHechas && (
                    <div className="p-3 space-y-3">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Horas a liquidar</label>
                        <input type="number" min={0} max={pendiente} step={0.5} value={liquidarHoras || ''}
                          onChange={(e) => setLiquidarHoras(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                          style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#92400E', fontWeight: 700 }} />
                        <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
                          Pendientes: <span className="font-semibold" style={{ color: '#DC2626' }}>{Math.max(0, pendiente - (liquidarHoras || 0)).toFixed(1)}h</span>
                          {' → '}
                          Liquidadas: <span className="font-semibold" style={{ color: '#16A34A' }}>{(liquidarHoras || 0).toFixed(1)}h</span>
                        </p>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Notas (opcional)</label>
                        <input type="text" value={liquidarNotas} onChange={(e) => setLiquidarNotas(e.target.value)}
                          placeholder="Ej. Pago noviembre 2026"
                          className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                          style={{ borderColor: '#E2E8F0', color: '#1E293B' }} />
                      </div>
                      <button onClick={async () => {
                        if (!liquidarHoras || liquidarHoras <= 0 || liquidarHoras > pendiente) return;
                        setSavingLiquidar(true);
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          const userId = session?.user?.id ?? null;
                          const { error: insErr } = await supabase.from('liquidaciones_horas').insert({
                            sustituto_id: s.sustituto_id,
                            sustituto_nombre: s.sustituto_nombre,
                            horas_liquidadas: liquidarHoras,
                            fecha: new Date().toISOString().slice(0, 10),
                            notas: liquidarNotas.trim() || null,
                            created_by: userId,
                          });
                          if (insErr) throw insErr;
                          const { error: updErr } = await supabase.from('sustituciones').update({ horas_liquidadas: true }).eq('id', s.id);
                          if (updErr) throw updErr;
                          setHorasHechas(true);
                          await load();
                        } catch (err: unknown) {
                          console.error(err);
                        } finally {
                          setSavingLiquidar(false);
                        }
                      }} disabled={savingLiquidar || !liquidarHoras || liquidarHoras <= 0 || liquidarHoras > pendiente}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#D97706' }}>
                        {savingLiquidar ? <RefreshCw size={14} className="animate-spin" /> : <Banknote size={14} />}
                        {savingLiquidar ? 'Liquidando...' : 'Liquidar horas'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Sección 2: Descontar días (solo si hay días) */}
                {hayDias && (
                  <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${diasHechos ? '#BBF7D0' : '#E2E8F0'}`, backgroundColor: diasHechos ? '#F0FDF4' : '#FAFBFC' }}>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${diasHechos ? '#BBF7D0' : '#E2E8F0'}` }}>
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} style={{ color: diasHechos ? '#16A34A' : '#64748B' }} />
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: diasHechos ? '#15803D' : '#1E293B' }}>Descontar días</span>
                      </div>
                      {diasHechos ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: '#16A34A', color: '#fff' }}>
                          <Check size={10} /> Hecho
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold" style={{ color: '#DC2626' }}>{dias} día{dias !== 1 ? 's' : ''} pendiente{dias !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {!diasHechos && (
                      <div className="p-3 space-y-3">
                        <p className="text-[11px]" style={{ color: '#64748B' }}>
                          Se descontarán <strong style={{ color: '#15803D' }}>{dias} día{dias !== 1 ? 's' : ''}</strong> del balance del trabajador.
                        </p>
                        <div>
                          <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Descripción del descuento</label>
                          <input type="text" value={descontarDesc} onChange={(e) => setDescontarDesc(e.target.value)}
                            placeholder="Ej. Nómina de junio" autoFocus
                            className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                            style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', color: '#15803D', fontWeight: 600 }} />
                        </div>
                        <button onClick={async () => {
                          if (!descontarDesc.trim()) return;
                          setSavingDescontar(true);
                          try {
                            const { error: updErr } = await supabase.from('sustituciones')
                              .update({ dias_descontados: true, descripcion_descuento: descontarDesc.trim() })
                              .eq('id', s.id);
                            if (updErr) throw updErr;
                            setDiasHechos(true);
                            await load();
                          } catch (err: unknown) {
                            console.error(err);
                          } finally {
                            setSavingDescontar(false);
                          }
                        }} disabled={savingDescontar || !descontarDesc.trim()}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ backgroundColor: '#16A34A' }}>
                          {savingDescontar ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                          {savingDescontar ? 'Descontando...' : 'Descontar días'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!hayDias && (
                  <p className="text-[11px] text-center" style={{ color: '#94A3B8' }}>No hay días configurados para descontar en esta sustitución.</p>
                )}
              </div>

              {/* Footer: Cerrar + Finalizar (solo cuando todo hecho) */}
              <div className="px-5 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <button onClick={() => setFinalizarTarget(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
                  Cerrar
                </button>
                <button onClick={async () => {
                  if (!todoHecho) return;
                  const { error: updErr } = await supabase.from('sustituciones')
                    .update({ finalizado: true, finalizado_at: new Date().toISOString() })
                    .eq('id', s.id);
                  if (!updErr) { setFinalizarTarget(null); await load(); }
                }} disabled={!todoHecho}
                  className="ml-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center gap-2"
                  style={{ backgroundColor: todoHecho ? '#16A34A' : '#94A3B8' }}>
                  <CheckCircle2 size={14} />
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit modal */}
      {editingRow && editForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-white" />
                <div>
                  <h2 className="text-white font-semibold text-sm">Editar sustitución</h2>
                  <p className="text-[10px] text-blue-100">{editingRow.sustituto_nombre}</p>
                </div>
              </div>
              <button onClick={() => { setEditingRow(null); setEditForm(null); }} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Sustituto</label>
                  <input type="text" value={editForm.sustituto_nombre} onChange={(e) => updField('sustituto_nombre', e.target.value)} className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none" style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#FFFFFF' }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Fecha</label>
                  <input type="date" value={editForm.fecha_inicio} onChange={(e) => updField('fecha_inicio', e.target.value)} className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none" style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#FFFFFF' }} />
                </div>
              </div>

              {/* Días a descontar + Justificante */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Días a descontar (opcional)</label>
                  <input type="number" min={0} step={1} value={editForm.dias_a_descontar ?? ''}
                    onChange={(e) => updField('dias_a_descontar', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="—"
                    className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none"
                    style={{ borderColor: '#FECACA', color: '#DC2626', backgroundColor: '#FEF2F2', fontWeight: 700, fontSize: '14px' }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Justificante (opcional)</label>
                  <button onClick={() => updField('tiene_justificante', !editForm.tiene_justificante)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs border cursor-pointer transition-all"
                    style={{ borderColor: editForm.tiene_justificante ? '#BBF7D0' : '#E2E8F0', backgroundColor: editForm.tiene_justificante ? '#F0FDF4' : '#F8FAFC', color: editForm.tiene_justificante ? '#16A34A' : '#94A3B8' }}>
                    {editForm.tiene_justificante ? <CheckSquare size={13} /> : <Square size={13} />}
                    <span className="font-semibold">{editForm.tiene_justificante ? 'Con justificante' : 'Sin justificante'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Unidad</label>
                <div className="flex gap-1.5">
                  {(['dias', 'horas'] as const).map((u) => (
                    <button key={u} onClick={() => updField('unidad', u)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all" style={{ backgroundColor: editForm.unidad === u ? '#0F172A' : '#F1F5F9', color: editForm.unidad === u ? '#FFFFFF' : '#64748B' }}>{u === 'dias' ? 'Días' : 'Horas'}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>{editForm.unidad === 'horas' ? 'Nº horas' : 'Nº días'}</label>
                  <input type="number" min={0} step={editForm.unidad === 'horas' ? 0.5 : 1}
                    value={editForm.unidad === 'horas' ? editForm.num_horas : editForm.num_dias}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      if (editForm.unidad === 'horas') updField('num_horas', v);
                      else { updField('num_dias', v); if (editForm.turno) updField('num_horas', v * (HORAS_POR_TURNO[editForm.turno] ?? 8)); }
                    }}
                    className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none" style={{ borderColor: '#BFDBFE', color: '#0369A1', backgroundColor: '#EFF6FF', fontWeight: 700, fontSize: '14px' }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Retribución</label>
                  <select value={editForm.tipo_cobertura} onChange={(e) => updField('tipo_cobertura', e.target.value)} className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none cursor-pointer" style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#FFFFFF' }}>
                    <option value="">—</option>
                    <option value="pagar">Pagar</option>
                    <option value="compensar">Compensar</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>
              {editForm.tipo_cobertura === 'otro' && (
                <input type="text" value={editForm.motivo_otro} onChange={(e) => updField('motivo_otro', e.target.value)} placeholder="Especifica motivo" className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none" style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#FFFFFF' }} />
              )}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Turno</label>
                <div className="flex gap-1.5">
                  {([['mañana', 'Mañana', Sun, '#D97706', '#FFFBEB', '#FDE68A'], ['tarde', 'Tarde', Sunset, '#EA580C', '#FFF7ED', '#FED7AA'], ['noche', 'Noche', Moon, '#7C3AED', '#F5F3FF', '#DDD6FE']] as const).map(([key, label, Icon, color, bg, border]) => {
                    const isActive = editForm.turno === key;
                    return (
                      <button key={key} onClick={() => { const nv = isActive ? '' : key; updField('turno', nv); if (!isActive && editForm.unidad === 'dias') updField('num_horas', editForm.num_dias * (HORAS_POR_TURNO[key] ?? 8)); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ backgroundColor: isActive ? bg : '#F8FAFC', color: isActive ? color : '#94A3B8', border: `1.5px solid ${isActive ? border : '#E2E8F0'}` }}>
                        <Icon size={11} />{label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-lg p-2.5" style={{ backgroundColor: editForm.es_festivo ? '#FEF9C3' : '#F8FAFC', border: `1.5px solid ${editForm.es_festivo ? '#FDE047' : '#E2E8F0'}` }}>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => updField('es_festivo', !editForm.es_festivo)} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer" style={{ color: editForm.es_festivo ? '#854D0E' : '#94A3B8' }}><Star size={12} />Festivo</button>
                  {editForm.es_festivo && (
                    <div className="flex gap-1">
                      {(['dias', 'horas'] as const).map((u) => (
                        <button key={u} onClick={() => updField('unidad_festivo', u)} className="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer" style={{ backgroundColor: editForm.unidad_festivo === u ? '#854D0E' : '#FEF9C3', color: editForm.unidad_festivo === u ? '#FFFFFF' : '#854D0E' }}>{u === 'dias' ? 'Días' : 'Horas'}</button>
                      ))}
                    </div>
                  )}
                </div>
                {editForm.es_festivo && (
                  <input type="number" min={0} step={editForm.unidad_festivo === 'horas' ? 0.5 : 1}
                    value={editForm.unidad_festivo === 'horas' ? editForm.horas_festivas : editForm.num_dias_festivos}
                    onChange={(e) => { const v = parseFloat(e.target.value) || 0; if (editForm.unidad_festivo === 'horas') updField('horas_festivas', v); else updField('num_dias_festivos', v); }}
                    className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none" style={{ borderColor: '#FDE047', color: '#854D0E', backgroundColor: '#FFFFFF', fontWeight: 700, fontSize: '14px' }}
                    placeholder={editForm.unidad_festivo === 'horas' ? 'Nº horas festivas' : 'Nº días festivos'} />
                )}
              </div>
              <div className="rounded-lg p-2.5" style={{ backgroundColor: editForm.es_nocturno ? '#F5F3FF' : '#F8FAFC', border: `1.5px solid ${editForm.es_nocturno ? '#DDD6FE' : '#E2E8F0'}` }}>
                <button onClick={() => updField('es_nocturno', !editForm.es_nocturno)} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer mb-2" style={{ color: editForm.es_nocturno ? '#7C3AED' : '#94A3B8' }}><Moon size={12} />Nocturnidad</button>
                {editForm.es_nocturno && (
                  <input type="number" min={0} step={0.5} value={editForm.horas_nocturnas} onChange={(e) => updField('horas_nocturnas', parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none" style={{ borderColor: '#DDD6FE', color: '#7C3AED', backgroundColor: '#FFFFFF', fontWeight: 700, fontSize: '14px' }} placeholder="Nº horas nocturnas" />
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Notas</label>
                <input type="text" value={editForm.notas} onChange={(e) => updField('notas', e.target.value)} placeholder="Observaciones..." className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none" style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#FFFFFF' }} />
              </div>
              {editError && <p className="text-xs" style={{ color: '#DC2626' }}>{editError}</p>}
            </div>
            <div className="px-5 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <button onClick={() => { setEditingRow(null); setEditForm(null); }} className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="ml-auto px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center gap-1.5" style={{ backgroundColor: '#0369A1' }}>
                {savingEdit ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {savingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
