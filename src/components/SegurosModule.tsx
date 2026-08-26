import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus, X, RefreshCw, Trash2, Search, Calendar, Building2, Euro, FileText, AlertCircle, ChevronUp, ChevronDown, CreditCard as Edit3, Save } from 'lucide-react';
import { supabase, type Seguro, type Sociedad } from '../supabaseClient';
import { useSociety } from '../context/SocietyContext';

const TIPOS_SEGURO = [
  'Responsabilidad Civil',
  'Hogar',
  'Vehiculo',
  'Salud',
  'Vida',
  'Accidentes',
  'Robo',
  'Incendio',
  'Transporte',
  'Defensa Juridica',
  'Otro',
];

const ESTADOS = ['activo', 'vencido', 'cancelado'];

interface FormState {
  sociedad_id: string;
  tipo: string;
  compania: string;
  numero_poliza: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  importe_anual: string;
  estado: string;
  beneficiario: string;
  cobertura: string;
  observaciones: string;
}

const EMPTY_FORM: FormState = {
  sociedad_id: '',
  tipo: 'Otro',
  compania: '',
  numero_poliza: '',
  fecha_inicio: '',
  fecha_vencimiento: '',
  importe_anual: '',
  estado: 'activo',
  beneficiario: '',
  cobertura: '',
  observaciones: '',
};

type SortKey = 'fecha_vencimiento' | 'importe_anual' | 'compania' | 'tipo';

export default function SegurosModule() {
  const { societies } = useSociety();
  const [seguros, setSeguros] = useState<Seguro[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterSociedad, setFilterSociedad] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fecha_vencimiento');
  const [sortAsc, setSortAsc] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [segRes, socRes] = await Promise.all([
        supabase.from('seguros').select('*').order('created_at', { ascending: false }),
        supabase.from('sociedades').select('id, nombre').order('nombre'),
      ]);
      if (segRes.error) throw segRes.error;
      if (socRes.error) throw socRes.error;
      setSeguros((segRes.data ?? []) as Seguro[]);
      setSociedades((socRes.data ?? []) as Sociedad[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar seguros';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showMsg = (m: string) => {
    setSuccess(m);
    setTimeout(() => setSuccess(''), 3000);
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (s: Seguro) => {
    setForm({
      sociedad_id: s.sociedad_id ?? '',
      tipo: s.tipo,
      compania: s.compania,
      numero_poliza: s.numero_poliza,
      fecha_inicio: s.fecha_inicio ?? '',
      fecha_vencimiento: s.fecha_vencimiento ?? '',
      importe_anual: s.importe_anual != null ? String(s.importe_anual) : '',
      estado: s.estado,
      beneficiario: s.beneficiario ?? '',
      cobertura: s.cobertura ?? '',
      observaciones: s.observaciones ?? '',
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    if (!form.compania.trim()) { setError('La compania es obligatoria'); return; }
    if (!form.numero_poliza.trim()) { setError('El numero de poliza es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        sociedad_id: form.sociedad_id || null,
        tipo: form.tipo,
        compania: form.compania.trim(),
        numero_poliza: form.numero_poliza.trim(),
        fecha_inicio: form.fecha_inicio || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        importe_anual: form.importe_anual === '' ? null : parseFloat(form.importe_anual),
        estado: form.estado,
        beneficiario: form.beneficiario.trim() || null,
        cobertura: form.cobertura.trim() || null,
        observaciones: form.observaciones.trim() || null,
      };
      if (editingId) {
        const { error: err } = await supabase.from('seguros').update(payload).eq('id', editingId);
        if (err) throw err;
        showMsg('Seguro actualizado correctamente');
      } else {
        const { error: err } = await supabase.from('seguros').insert(payload);
        if (err) throw err;
        showMsg('Seguro creado correctamente');
      }
      cancelForm();
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar seguro';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este seguro? Esta accion no se puede deshacer.')) return;
    try {
      const { error: err } = await supabase.from('seguros').delete().eq('id', id);
      if (err) throw err;
      showMsg('Seguro eliminado');
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const filtered = seguros
    .filter((s) => {
      if (filterEstado && s.estado !== filterEstado) return false;
      if (filterSociedad && s.sociedad_id !== filterSociedad) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.compania.toLowerCase().includes(q) ||
          s.numero_poliza.toLowerCase().includes(q) ||
          s.tipo.toLowerCase().includes(q) ||
          (s.beneficiario ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'importe_anual') {
        av = a.importe_anual ?? 0;
        bv = b.importe_anual ?? 0;
      } else if (sortKey === 'fecha_vencimiento') {
        av = a.fecha_vencimiento ?? '9999';
        bv = b.fecha_vencimiento ?? '9999';
      } else {
        av = a[sortKey] ?? '';
        bv = b[sortKey] ?? '';
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sociedadNombre = (id: string | null) => {
    if (!id) return '—';
    return sociedades.find((s) => s.id === id)?.nombre ?? '—';
  };

  const isVencido = (fecha: string | null) => {
    if (!fecha) return false;
    return new Date(fecha) < new Date();
  };

  const fmtFecha = (f: string | null) => f ? new Date(f).toLocaleDateString('es-ES') : '—';
  const fmtImporte = (n: number | null) => n != null ? `${n.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—';

  const estadoColor: Record<string, { bg: string; text: string; border: string }> = {
    activo: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    vencido: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    cancelado: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
            <ShieldCheck size={20} style={{ color: '#0369A1' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Seguros</h2>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Gestion de polizas y seguros de la empresa</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
        >
          <Plus size={15} /> Nuevo seguro
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
          <ShieldCheck size={15} /> {success}
        </div>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
              {editingId ? 'Editar seguro' : 'Nuevo seguro'}
            </h3>
            <button onClick={cancelForm} className="cursor-pointer" style={{ color: '#94A3B8' }}><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
                {TIPOS_SEGURO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Compania *</label>
              <input value={form.compania} onChange={(e) => setForm({ ...form, compania: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
                placeholder="Nombre de la aseguradora" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Numero de poliza *</label>
              <input value={form.numero_poliza} onChange={(e) => setForm({ ...form, numero_poliza: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
                placeholder="Ej: POL-2024-001" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Sociedad</label>
              <select value={form.sociedad_id} onChange={(e) => setForm({ ...form, sociedad_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
                <option value="">Sin asignar</option>
                {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Fecha vencimiento</label>
              <input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Importe anual (€)</label>
              <input type="number" step="0.01" value={form.importe_anual} onChange={(e) => setForm({ ...form, importe_anual: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
                placeholder="Ej: 1200.00" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Beneficiario</label>
              <input value={form.beneficiario} onChange={(e) => setForm({ ...form, beneficiario: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
                placeholder="Beneficiario (opcional)" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Cobertura</label>
              <input value={form.cobertura} onChange={(e) => setForm({ ...form, cobertura: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
                placeholder="Descripcion de la cobertura" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Observaciones</label>
              <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
                placeholder="Notas adicionales..." />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button onClick={cancelForm} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por compania, poliza, tipo..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
          />
        </div>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filterSociedad} onChange={(e) => setFilterSociedad(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
          <option value="">Todas las sociedades</option>
          {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-200"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#64748B' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer" style={{ color: '#64748B' }}
                  onClick={() => toggleSort('compania')}>
                  <span className="flex items-center gap-1">Compania {sortKey === 'compania' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Poliza</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer" style={{ color: '#64748B' }}
                  onClick={() => toggleSort('tipo')}>
                  <span className="flex items-center gap-1">Tipo {sortKey === 'tipo' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Sociedad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer" style={{ color: '#64748B' }}
                  onClick={() => toggleSort('fecha_vencimiento')}>
                  <span className="flex items-center gap-1">Vencimiento {sortKey === 'fecha_vencimiento' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer" style={{ color: '#64748B' }}
                  onClick={() => toggleSort('importe_anual')}>
                  <span className="flex items-center gap-1 justify-end">Importe {sortKey === 'importe_anual' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="py-10 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto" style={{ color: '#94A3B8' }} />
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>
                  No hay seguros registrados
                </td></tr>
              )}
              {!loading && filtered.map((s) => {
              const sc = estadoColor[s.estado] ?? estadoColor.activo;
              const venc = s.estado === 'activo' && isVencido(s.fecha_vencimiento);
              return (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{s.compania || '—'}</p>
                    {s.beneficiario && <p className="text-xs" style={{ color: '#94A3B8' }}>Benef: {s.beneficiario}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-mono" style={{ color: '#1E293B' }}>{s.numero_poliza || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                      {s.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs" style={{ color: '#64748B' }}>{sociedadNombre(s.sociedad_id)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm" style={{ color: venc ? '#DC2626' : '#1E293B', fontWeight: venc ? 600 : 400 }}>
                      {fmtFecha(s.fecha_vencimiento)}
                    </p>
                    {s.fecha_inicio && <p className="text-xs" style={{ color: '#94A3B8' }}>Inicio: {fmtFecha(s.fecha_inicio)}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{fmtImporte(s.importe_anual)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                      {venc ? 'vencido' : s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(s)} title="Editar"
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
                        <Edit3 size={12} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} title="Eliminar"
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
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

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading && (
            <div className="py-10 text-center">
              <RefreshCw size={18} className="animate-spin mx-auto" style={{ color: '#94A3B8' }} />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>No hay seguros registrados</div>
          )}
          {!loading && filtered.map((s) => {
            const sc = estadoColor[s.estado] ?? estadoColor.activo;
            const venc = s.estado === 'activo' && isVencido(s.fecha_vencimiento);
            return (
              <div key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{s.compania || '—'}</p>
                    <p className="text-xs font-mono" style={{ color: '#64748B' }}>{s.numero_poliza}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                    {venc ? 'vencido' : s.estado}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: '#64748B' }}>
                  <span>Tipo: {s.tipo}</span>
                  <span>Sociedad: {sociedadNombre(s.sociedad_id)}</span>
                  <span>Vencimiento: <span style={{ color: venc ? '#DC2626' : '#1E293B', fontWeight: venc ? 600 : 400 }}>{fmtFecha(s.fecha_vencimiento)}</span></span>
                  <span>Importe: {fmtImporte(s.importe_anual)}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(s)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
                    <Edit3 size={11} /> Editar
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                    <Trash2 size={11} /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary footer */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Total seguros</p>
            <p className="text-xl font-bold" style={{ color: '#0F172A' }}>{filtered.length}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <p className="text-xs" style={{ color: '#16A34A' }}>Activos</p>
            <p className="text-xl font-bold" style={{ color: '#16A34A' }}>{filtered.filter((s) => s.estado === 'activo' && !isVencido(s.fecha_vencimiento)).length}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p className="text-xs" style={{ color: '#DC2626' }}>Vencidos</p>
            <p className="text-xl font-bold" style={{ color: '#DC2626' }}>{filtered.filter((s) => isVencido(s.fecha_vencimiento) || s.estado === 'vencido').length}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <p className="text-xs" style={{ color: '#0369A1' }}>Importe total anual</p>
            <p className="text-xl font-bold" style={{ color: '#0369A1' }}>
              {filtered.reduce((sum, s) => sum + (s.importe_anual ?? 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
