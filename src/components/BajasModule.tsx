import { useState, useEffect, useCallback } from 'react';
import { BedSingle, Plus, X, Trash2, CreditCard as Edit2, Search, RefreshCw, Download, Calendar, UserCheck, AlertCircle, CheckCircle2, Clock, CalendarOff, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  id_sociedad: string | null;
  activo: boolean;
}

interface Baja {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  total_dias: number;
  motivo: string | null;
  estado: string;
  created_by: string | null;
  created_at: string;
}

interface Sustitucion {
  id: string;
  baja_id: string;
  sustituto_id: string;
  sustituto_nombre: string;
  fecha_inicio: string;
  num_dias: number;
  notas: string | null;
}

interface BajaWithSustituciones extends Baja {
  sustituciones: Sustitucion[];
  dias_asignados: number;
}

interface SustitucionForm {
  sustituto_id: string;
  sustituto_nombre: string;
  fecha_inicio: string;
  num_dias: number;
  notas: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

export default function BajasModule() {
  const [bajas, setBajas] = useState<BajaWithSustituciones[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [editingBaja, setEditingBaja] = useState<Baja | null>(null);
  const [savingBaja, setSavingBaja] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Baja form
  const [bajaForm, setBajaForm] = useState({
    empleado_id: '',
    empleado_nombre: '',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: '',
  });

  // Sustituciones form (within baja modal)
  const [sustitucionesForm, setSustitucionesForm] = useState<SustitucionForm[]>([]);
  const [sustitutoSearch, setSustitutoSearch] = useState('');
  const [showSustitutoDropdown, setShowSustitutoDropdown] = useState(false);

  // Report view
  const [reporteView, setReporteView] = useState<'bajas' | 'balance'>('bajas');
  const [reporteFechaInicio, setReporteFechaInicio] = useState('');
  const [reporteFechaFin, setReporteFechaFin] = useState('');

  const loadEmpleados = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('empleados')
      .select('id, nombre, dni, id_sociedad, activo')
      .order('nombre', { ascending: true });
    if (err) { setError(err.message); return; }
    setEmpleados(data ?? []);
  }, []);

  const loadBajas = useCallback(async () => {
    setLoading(true);
    const { data: bajasData, error: err } = await supabase
      .from('bajas_temporales')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }

    const { data: sustData, error: sustErr } = await supabase
      .from('sustituciones')
      .select('*')
      .order('created_at', { ascending: false });
    if (sustErr) { setError(sustErr.message); setLoading(false); return; }

    const enriched: BajaWithSustituciones[] = (bajasData ?? []).map((b) => {
      const susts = (sustData ?? []).filter((s) => s.baja_id === b.id);
      return {
        ...b,
        sustituciones: susts,
        dias_asignados: susts.reduce((sum, s) => sum + s.num_dias, 0),
      };
    });
    setBajas(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEmpleados();
    loadBajas();
  }, [loadEmpleados, loadBajas]);

  const totalDiasBaja = bajaForm.fecha_inicio && bajaForm.fecha_fin
    ? daysBetween(bajaForm.fecha_inicio, bajaForm.fecha_fin)
    : 0;

  const totalDiasAsignados = sustitucionesForm.reduce((sum, s) => sum + s.num_dias, 0);

  const openNewBaja = () => {
    setEditingBaja(null);
    setBajaForm({ empleado_id: '', empleado_nombre: '', fecha_inicio: '', fecha_fin: '', motivo: '' });
    setSustitucionesForm([]);
    setShowBajaModal(true);
    setError('');
  };

  const openEditBaja = async (baja: BajaWithSustituciones) => {
    setEditingBaja(baja);
    setBajaForm({
      empleado_id: baja.empleado_id,
      empleado_nombre: baja.empleado_nombre,
      fecha_inicio: baja.fecha_inicio,
      fecha_fin: baja.fecha_fin ?? '',
      motivo: baja.motivo ?? '',
    });
    setSustitucionesForm(
      baja.sustituciones.map((s) => ({
        sustituto_id: s.sustituto_id,
        sustituto_nombre: s.sustituto_nombre,
        fecha_inicio: s.fecha_inicio,
        num_dias: s.num_dias,
        notas: s.notas ?? '',
      }))
    );
    setShowBajaModal(true);
    setError('');
  };

  const handleSelectEmpleado = (emp: Empleado) => {
    setBajaForm({ ...bajaForm, empleado_id: emp.id, empleado_nombre: emp.nombre });
  };

  const addSustitucionBlock = (emp: Empleado) => {
    const existing = sustitucionesForm.find((s) => s.sustituto_id === emp.id);
    if (existing) {
      setError(`${emp.nombre} ya esta asignado como sustituto en esta baja.`);
      return;
    }
    setSustitucionesForm([
      ...sustitucionesForm,
      {
        sustituto_id: emp.id,
        sustituto_nombre: emp.nombre,
        fecha_inicio: bajaForm.fecha_inicio || '',
        num_dias: 1,
        notas: '',
      },
    ]);
    setShowSustitutoDropdown(false);
    setSustitutoSearch('');
    setError('');
  };

  const updateSustitucion = (idx: number, field: keyof SustitucionForm, value: string | number) => {
    setSustitucionesForm((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const removeSustitucion = (idx: number) => {
    setSustitucionesForm((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveBaja = async () => {
    if (!bajaForm.empleado_id) { setError('Selecciona un trabajador.'); return; }
    if (!bajaForm.fecha_inicio) { setError('La fecha de inicio es obligatoria.'); return; }
    if (!bajaForm.fecha_fin) { setError('La fecha de fin es obligatoria.'); return; }
    if (totalDiasBaja <= 0) { setError('Las fechas no son validas.'); return; }

    if (sustitucionesForm.length > 0 && totalDiasAsignados !== totalDiasBaja) {
      setError(
        `La suma de dias de los sustitutos (${totalDiasAsignados}) no coincide con el total de la baja (${totalDiasBaja}).`
      );
      return;
    }

    setSavingBaja(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      const bajaPayload = {
        empleado_id: bajaForm.empleado_id,
        empleado_nombre: bajaForm.empleado_nombre,
        fecha_inicio: bajaForm.fecha_inicio,
        fecha_fin: bajaForm.fecha_fin || null,
        total_dias: totalDiasBaja,
        motivo: bajaForm.motivo.trim() || null,
        estado: 'activa',
        created_by: userId,
        updated_at: new Date().toISOString(),
      };

      let bajaId: string;

      if (editingBaja) {
        const { error: updErr } = await supabase
          .from('bajas_temporales')
          .update(bajaPayload)
          .eq('id', editingBaja.id);
        if (updErr) throw updErr;
        bajaId = editingBaja.id;

        // Delete existing sustituciones and re-insert
        await supabase.from('sustituciones').delete().eq('baja_id', bajaId);
      } else {
        const { data: newBaja, error: insErr } = await supabase
          .from('bajas_temporales')
          .insert(bajaPayload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        bajaId = newBaja.id;
      }

      // Insert sustituciones
      if (sustitucionesForm.length > 0) {
        const sustRows = sustitucionesForm.map((s) => ({
          baja_id: bajaId,
          sustituto_id: s.sustituto_id,
          sustituto_nombre: s.sustituto_nombre,
          fecha_inicio: s.fecha_inicio,
          num_dias: s.num_dias,
          notas: s.notas.trim() || null,
        }));
        const { error: sustErr } = await supabase.from('sustituciones').insert(sustRows);
        if (sustErr) throw sustErr;
      }

      setShowBajaModal(false);
      await loadBajas();
      setSuccessMsg(editingBaja ? 'Baja actualizada correctamente.' : 'Baja registrada correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingBaja(false);
    }
  };

  const handleDeleteBaja = async (baja: BajaWithSustituciones) => {
    if (!confirm(`Eliminar la baja de ${baja.empleado_nombre}? Se borraran tambien sus sustituciones.`)) return;
    try {
      const { error: delErr } = await supabase.from('bajas_temporales').delete().eq('id', baja.id);
      if (delErr) throw delErr;
      await loadBajas();
      setSuccessMsg('Baja eliminada.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const handleFinalizarBaja = async (baja: BajaWithSustituciones) => {
    try {
      const { error: updErr } = await supabase
        .from('bajas_temporales')
        .update({ estado: 'finalizada', updated_at: new Date().toISOString() })
        .eq('id', baja.id);
      if (updErr) throw updErr;
      await loadBajas();
      setSuccessMsg('Baja finalizada.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al finalizar');
    }
  };

  const filteredEmpleados = empleados.filter((e) =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (e.dni ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredSustitutos = empleados.filter((e) =>
    e.nombre.toLowerCase().includes(sustitutoSearch.toLowerCase()) &&
    e.id !== bajaForm.empleado_id &&
    !sustitucionesForm.some((s) => s.sustituto_id === e.id)
  );

  const filteredBajas = bajas.filter((b) => {
    if (filterEstado && b.estado !== filterEstado) return false;
    if (search && !b.empleado_nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (reporteFechaInicio && b.fecha_inicio < reporteFechaInicio) return false;
    if (reporteFechaFin && b.fecha_fin && b.fecha_fin > reporteFechaFin) return false;
    return true;
  });

  // Balance data: aggregate days per sustituto
  const balanceData: { sustituto_id: string; sustituto_nombre: string; total_dias: number; num_sustituciones: number }[] = [];
  const balanceMap = new Map<string, { nombre: string; dias: number; count: number }>();
  for (const b of bajas) {
    for (const s of b.sustituciones) {
      if (reporteFechaInicio && s.fecha_inicio < reporteFechaInicio) continue;
      if (reporteFechaFin && s.fecha_inicio > reporteFechaFin) continue;
      const existing = balanceMap.get(s.sustituto_id);
      if (existing) {
        existing.dias += s.num_dias;
        existing.count += 1;
      } else {
        balanceMap.set(s.sustituto_id, { nombre: s.sustituto_nombre, dias: s.num_dias, count: 1 });
      }
    }
  }
  for (const [id, val] of balanceMap) {
    balanceData.push({ sustituto_id: id, sustituto_nombre: val.nombre, total_dias: val.dias, num_sustituciones: val.count });
  }
  balanceData.sort((a, b) => b.total_dias - a.total_dias);

  const exportCSV = () => {
    if (reporteView === 'bajas') {
      const headers = ['Trabajador', 'Fecha Inicio', 'Fecha Fin', 'Total Dias', 'Dias Asignados', 'Motivo', 'Estado', 'Sustitutos'];
      const rows = filteredBajas.map((b) => [
        b.empleado_nombre,
        b.fecha_inicio,
        b.fecha_fin ?? '',
        b.total_dias,
        b.dias_asignados,
        b.motivo ?? '',
        b.estado,
        b.sustituciones.map((s) => `${s.sustituto_nombre} (${s.num_dias}d)`).join('; '),
      ]);
      const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadCSV(csv, 'bajas_ausencias');
    } else {
      const headers = ['Sustituto', 'Total Dias Cubiertos', 'Num Sustituciones'];
      const rows = balanceData.map((b) => [b.sustituto_nombre, b.total_dias, b.num_sustituciones]);
      const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadCSV(csv, 'balance_sustituciones');
    }
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const estadoConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    activa: { label: 'Activa', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    finalizada: { label: 'Finalizada', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertCircle size={16} style={{ color: '#DC2626' }} />
          <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
          <p className="text-xs font-medium" style={{ color: '#16A34A' }}>{successMsg}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            <button
              onClick={() => setReporteView('bajas')}
              className="px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: reporteView === 'bajas' ? '#0369A1' : '#FFFFFF',
                color: reporteView === 'bajas' ? '#FFFFFF' : '#64748B',
              }}
            >
              Bajas
            </button>
            <button
              onClick={() => setReporteView('balance')}
              className="px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: reporteView === 'balance' ? '#0369A1' : '#FFFFFF',
                color: reporteView === 'balance' ? '#FFFFFF' : '#64748B',
              }}
            >
              Balance Sustitutos
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar trabajador..."
              className="pl-8 pr-3 py-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B', width: '180px' }}
            />
          </div>

          {reporteView === 'bajas' && (
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs border outline-none cursor-pointer"
              style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
            >
              <option value="">Todos los estados</option>
              <option value="activa">Activas</option>
              <option value="finalizada">Finalizadas</option>
            </select>
          )}

          {/* Date range filter */}
          <div className="flex items-center gap-1.5">
            <Calendar size={14} style={{ color: '#94A3B8' }} />
            <input
              type="date"
              value={reporteFechaInicio}
              onChange={(e) => setReporteFechaInicio(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
            />
            <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
            <input
              type="date"
              value={reporteFechaFin}
              onChange={(e) => setReporteFechaFin(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
            />
            {(reporteFechaInicio || reporteFechaFin) && (
              <button
                onClick={() => { setReporteFechaInicio(''); setReporteFechaFin(''); }}
                className="px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all"
                style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <button
            onClick={openNewBaja}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all cursor-pointer"
            style={{ backgroundColor: '#0369A1' }}
          >
            <Plus size={14} />
            Nueva Baja
          </button>
        </div>
      </div>

      {/* KPIs */}
      {reporteView === 'bajas' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} style={{ color: '#D97706' }} />
              <p className="text-xs font-semibold" style={{ color: '#D97706' }}>Bajas Activas</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#D97706' }}>{bajas.filter((b) => b.estado === 'activa').length}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-2 mb-1">
              <CalendarOff size={14} style={{ color: '#64748B' }} />
              <p className="text-xs font-semibold" style={{ color: '#64748B' }}>Total Bajas</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#64748B' }}>{bajas.length}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <div className="flex items-center gap-2 mb-1">
              <BedSingle size={14} style={{ color: '#0369A1' }} />
              <p className="text-xs font-semibold" style={{ color: '#0369A1' }}>Dias de Baja</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#0369A1' }}>{bajas.reduce((s, b) => s + b.total_dias, 0)}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div className="flex items-center gap-2 mb-1">
              <UserCheck size={14} style={{ color: '#16A34A' }} />
              <p className="text-xs font-semibold" style={{ color: '#16A34A' }}>Sustituciones</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#16A34A' }}>{bajas.reduce((s, b) => s + b.sustituciones.length, 0)}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div className="flex items-center gap-2 mb-1">
              <UserCheck size={14} style={{ color: '#16A34A' }} />
              <p className="text-xs font-semibold" style={{ color: '#16A34A' }}>Total Sustitutos</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#16A34A' }}>{balanceData.length}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={14} style={{ color: '#0369A1' }} />
              <p className="text-xs font-semibold" style={{ color: '#0369A1' }}>Dias Totales Cubiertos</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#0369A1' }}>{balanceData.reduce((s, b) => s + b.total_dias, 0)}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw size={14} style={{ color: '#D97706' }} />
              <p className="text-xs font-semibold" style={{ color: '#D97706' }}>Total Asignaciones</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#D97706' }}>{balanceData.reduce((s, b) => s + b.num_sustituciones, 0)}</p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
      ) : reporteView === 'bajas' ? (
        filteredBajas.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <BedSingle size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay bajas registradas</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Crea una nueva baja con el boton de arriba</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBajas.map((baja) => {
              const cfg = estadoConfig[baja.estado] ?? estadoConfig.activa;
              const diasPendientes = baja.total_dias - baja.dias_asignados;
              return (
                <div key={baja.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                        <BedSingle size={16} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold" style={{ color: '#0F172A' }}>{baja.empleado_nombre}</h4>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: '#94A3B8' }}>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} /> {formatDate(baja.fecha_inicio)}
                          </span>
                          <ArrowRight size={11} />
                          <span className="flex items-center gap-1">
                            <Calendar size={11} /> {formatDate(baja.fecha_fin)}
                          </span>
                          <span style={{ color: '#0369A1', fontWeight: 600 }}>{baja.total_dias} dias</span>
                          {baja.motivo && <span>· {baja.motivo}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {baja.estado === 'activa' && (
                          <button
                            onClick={() => handleFinalizarBaja(baja)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                            style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                            title="Finalizar baja"
                          >
                            Finalizar
                          </button>
                        )}
                        <button
                          onClick={() => openEditBaja(baja)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                          style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteBaja(baja)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Sustituciones summary */}
                    {baja.sustituciones.length > 0 ? (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>
                          Sustituciones ({baja.sustituciones.length}) — {baja.dias_asignados}/{baja.total_dias} dias asignados
                        </p>
                        <div className="space-y-1.5">
                          {baja.sustituciones.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                              <UserCheck size={12} style={{ color: '#16A34A' }} />
                              <span className="text-xs font-medium" style={{ color: '#1E293B' }}>{s.sustituto_nombre}</span>
                              <span className="text-xs" style={{ color: '#94A3B8' }}>· {formatDate(s.fecha_inicio)} · {s.num_dias} dia(s)</span>
                              {s.notas && <span className="text-xs" style={{ color: '#94A3B8' }}>· {s.notas}</span>}
                            </div>
                          ))}
                        </div>
                        {diasPendientes > 0 && (
                          <p className="text-xs mt-2" style={{ color: '#D97706' }}>
            Faltan {diasPendientes} dia(s) por asignar a sustitutos.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>Sin sustituciones asignadas. Edita la baja para anadir sustitutos.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Balance view */
        balanceData.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <UserCheck size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay sustituciones registradas</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Las asignaciones de sustitutos apareceran aqui</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
                Balance de Dias por Sustituto
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {balanceData.map((b) => (
                <div key={b.sustituto_id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FDF4' }}>
                    <UserCheck size={14} style={{ color: '#16A34A' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{b.sustituto_nombre}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{b.num_sustituciones} sustitucion(es)</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold" style={{ color: '#0369A1' }}>{b.total_dias}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>dias</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── Baja Modal ── */}
      {showBajaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
              <h2 className="text-white font-semibold text-sm">{editingBaja ? 'Editar Baja' : 'Nueva Baja Temporal'}</h2>
              <button onClick={() => setShowBajaModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Trabajador selector */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Trabajador *</label>
                {bajaForm.empleado_id ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#0369A1', color: '#fff' }}>
                      {bajaForm.empleado_nombre.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium flex-1" style={{ color: '#1E293B' }}>{bajaForm.empleado_nombre}</span>
                    {!editingBaja && (
                      <button onClick={() => setBajaForm({ ...bajaForm, empleado_id: '', empleado_nombre: '' })} className="text-xs cursor-pointer" style={{ color: '#64748B' }}>
                        Cambiar
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar trabajador..."
                        className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border outline-none"
                        style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                      />
                    </div>
                    {search && (
                      <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg" style={{ border: '1px solid #E2E8F0' }}>
                        {filteredEmpleados.length === 0 ? (
                          <p className="text-xs text-center py-3" style={{ color: '#94A3B8' }}>No se encontraron trabajadores</p>
                        ) : (
                          filteredEmpleados.slice(0, 8).map((emp) => (
                            <button
                              key={emp.id}
                              onClick={() => { handleSelectEmpleado(emp); setSearch(''); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-all cursor-pointer"
                              style={{ borderBottom: '1px solid #F1F5F9' }}
                            >
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                                {emp.nombre.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium" style={{ color: '#1E293B' }}>{emp.nombre}</span>
                              {emp.dni && <span className="text-xs" style={{ color: '#94A3B8' }}>{emp.dni}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Fecha Inicio *</label>
                  <input
                    type="date"
                    value={bajaForm.fecha_inicio}
                    onChange={(e) => setBajaForm({ ...bajaForm, fecha_inicio: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Fecha Fin *</label>
                  <input
                    type="date"
                    value={bajaForm.fecha_fin}
                    onChange={(e) => setBajaForm({ ...bajaForm, fecha_fin: e.target.value })}
                    min={bajaForm.fecha_inicio}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                  />
                </div>
              </div>

              {totalDiasBaja > 0 && (
                <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <Calendar size={14} style={{ color: '#0369A1' }} />
                  <span className="text-xs font-semibold" style={{ color: '#0369A1' }}>Total dias de baja: {totalDiasBaja}</span>
                </div>
              )}

              {/* Motivo */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Motivo (opcional)</label>
                <input
                  type="text"
                  value={bajaForm.motivo}
                  onChange={(e) => setBajaForm({ ...bajaForm, motivo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                  placeholder="Ej. Baja medica, accidente, permiso..."
                />
              </div>

              {/* Sustituciones */}
              <div className="pt-2 border-t" style={{ borderColor: '#F1F5F9' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
                    Sustituciones ({sustitucionesForm.length})
                  </p>
                  <span className="text-xs font-semibold" style={{ color: totalDiasAsignados === totalDiasBaja && totalDiasBaja > 0 ? '#16A34A' : '#D97706' }}>
                    {totalDiasAsignados}/{totalDiasBaja} dias
                  </span>
                </div>

                {/* Add sustituto */}
                <div className="relative mb-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input
                      type="text"
                      value={sustitutoSearch}
                      onChange={(e) => { setSustitutoSearch(e.target.value); setShowSustitutoDropdown(true); }}
                      onFocus={() => setShowSustitutoDropdown(true)}
                      placeholder="Buscar sustituto..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border outline-none"
                      style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                    />
                  </div>
                  {showSustitutoDropdown && sustitutoSearch && (
                    <div className="absolute z-10 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-lg bg-white" style={{ border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                      {filteredSustitutos.length === 0 ? (
                        <p className="text-xs text-center py-2" style={{ color: '#94A3B8' }}>No hay candidatos</p>
                      ) : (
                        filteredSustitutos.slice(0, 6).map((emp) => (
                          <button
                            key={emp.id}
                            onClick={() => addSustitucionBlock(emp)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-all cursor-pointer"
                            style={{ borderBottom: '1px solid #F1F5F9' }}
                          >
                            <Plus size={12} style={{ color: '#0369A1' }} />
                            <span className="text-xs font-medium" style={{ color: '#1E293B' }}>{emp.nombre}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Sustitucion blocks */}
                {sustitucionesForm.length === 0 ? (
                  <p className="text-xs text-center py-3" style={{ color: '#94A3B8' }}>
                    Anade sustitutos buscando arriba. Cada bloque representa dias asignados a un sustituto.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sustitucionesForm.map((s, idx) => (
                      <div key={idx} className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <UserCheck size={12} style={{ color: '#16A34A' }} />
                          <span className="text-xs font-semibold flex-1" style={{ color: '#1E293B' }}>{s.sustituto_nombre}</span>
                          <button
                            onClick={() => removeSustitucion(idx)}
                            className="w-6 h-6 rounded flex items-center justify-center cursor-pointer"
                            style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-medium block mb-0.5" style={{ color: '#94A3B8' }}>Fecha inicio</label>
                            <input
                              type="date"
                              value={s.fecha_inicio}
                              onChange={(e) => updateSustitucion(idx, 'fecha_inicio', e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-xs border outline-none"
                              style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium block mb-0.5" style={{ color: '#94A3B8' }}>Num. dias</label>
                            <input
                              type="number"
                              min={1}
                              value={s.num_dias}
                              onChange={(e) => updateSustitucion(idx, 'num_dias', parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1.5 rounded text-xs border outline-none"
                              style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                            />
                          </div>
                        </div>
                        <div className="mt-2">
                          <input
                            type="text"
                            value={s.notas}
                            onChange={(e) => updateSustitucion(idx, 'notas', e.target.value)}
                            placeholder="Notas (opcional)..."
                            className="w-full px-2 py-1.5 rounded text-xs border outline-none"
                            style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation indicator */}
                {totalDiasBaja > 0 && sustitucionesForm.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    {totalDiasAsignados === totalDiasBaja ? (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#16A34A' }}>
                        <CheckCircle2 size={14} />
                        <span>Dias asignados correctamente ({totalDiasAsignados}/{totalDiasBaja})</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#D97706' }}>
                        <AlertCircle size={14} />
                        <span>La suma de dias ({totalDiasAsignados}) debe coincidir con el total ({totalDiasBaja})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
            </div>

            <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0' }}>
              <button
                onClick={handleSaveBaja}
                disabled={savingBaja}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
                style={{ backgroundColor: '#0369A1' }}
              >
                {savingBaja ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {savingBaja ? 'Guardando...' : editingBaja ? 'Actualizar Baja' : 'Registrar Baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
