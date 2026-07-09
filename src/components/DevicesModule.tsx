import { useState, useEffect, useCallback } from 'react';
import {
  Laptop, Plus, X, Loader2, Pencil, Trash2, Search,
  Monitor, Smartphone, Tablet, Server, Printer, Cpu,
  AlertCircle, FileDown, User, ArrowUp, ArrowDown,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Dispositivo {
  id: string;
  tipo: string;
  marca_modelo: string;
  caracteristicas: string;
  centro_trabajo: string;
  numero_serie: string;
  society_id: string | null;
  empleado_id: string | null;
  usuario_asignado_nombre: string;
  fecha_asignacion: string | null;
  notas: string;
  etiquetado: string | null;
  estado_id: number;
  valor_estimado: number | null;
  created_at: string;
  updated_at: string;
}

interface Empleado {
  id: string;
  nombre: string;
  email: string;
  dni: string | null;
}

interface Sociedad {
  id: string;
  nombre: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIPOS = ['Portatil', 'Movil', 'Tablet', 'Monitor', 'Impresora', 'Servidor', 'Sobremesa', 'Periferico', 'Otro'];

const ESTADOS: Record<number, { label: string; color: string; dot: string }> = {
  1: { label: 'Activo',          color: '#16A34A', dot: '#22C55E' },
  2: { label: 'En reparacion',   color: '#D97706', dot: '#F59E0B' },
  3: { label: 'Almacenado',      color: '#2563EB', dot: '#3B82F6' },
  4: { label: 'Baja',            color: '#DC2626', dot: '#EF4444' },
};

const TIPO_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Portatil:  Laptop,
  Movil:     Smartphone,
  Tablet:    Tablet,
  Monitor:   Monitor,
  Impresora: Printer,
  Servidor:  Server,
  Sobremesa: Monitor,
  Periferico: Cpu,
  Otro:      Cpu,
};

const TIPO_ICON_BG: Record<number, { bg: string; color: string }> = {
  1: { bg: '#DCFCE7', color: '#16A34A' },
  2: { bg: '#FEF9C3', color: '#CA8A04' },
  3: { bg: '#DBEAFE', color: '#2563EB' },
  4: { bg: '#FEE2E2', color: '#DC2626' },
};

// ─── PDF Generator ─────────────────────────────────────────────────────────────

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

async function generateEntregaPDF(
  dispositivo: Dispositivo,
  empleado: Empleado | null,
  societyName: string,
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica);
  const PRIMARY = rgb(0.05, 0.33, 0.55);
  const DARK    = rgb(0.07, 0.09, 0.16);
  const GRAY    = rgb(0.38, 0.45, 0.55);
  const LIGHT   = rgb(0.95, 0.97, 0.99);
  const WHITE   = rgb(1, 1, 1);

  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: PRIMARY });
  page.drawText('ACTA DE ENTREGA DE DISPOSITIVO', { x: 40, y: height - 38, size: 16, font: fontBold, color: WHITE });
  page.drawText(societyName.toUpperCase(), { x: 40, y: height - 58, size: 10, font: fontNormal, color: rgb(0.7, 0.85, 1) });
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  page.drawText(today, { x: width - 40 - fontNormal.widthOfTextAtSize(today, 9), y: height - 58, size: 9, font: fontNormal, color: rgb(0.7, 0.85, 1) });

  let y = height - 110;
  const drawSection = (title: string) => {
    page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 22, color: LIGHT });
    page.drawLine({ start: { x: 40, y: y - 4 }, end: { x: 40, y: y + 18 }, thickness: 3, color: PRIMARY });
    page.drawText(title.toUpperCase(), { x: 50, y: y + 4, size: 8.5, font: fontBold, color: PRIMARY });
    y -= 28;
  };
  const drawRow = (label: string, value: string) => {
    page.drawText(label + ':', { x: 60, y, size: 9, font: fontBold, color: GRAY });
    page.drawText(value || '—', { x: 200, y, size: 9, font: fontNormal, color: DARK });
    y -= 16;
  };

  drawSection('Datos del Dispositivo');
  drawRow('Tipo',              dispositivo.tipo);
  drawRow('Marca / Modelo',    dispositivo.marca_modelo);
  drawRow('Numero de serie',   dispositivo.numero_serie || '—');
  drawRow('Etiquetado',        dispositivo.etiquetado || '—');
  drawRow('Caracteristicas',   dispositivo.caracteristicas || '—');
  drawRow('Centro de trabajo', dispositivo.centro_trabajo || '—');
  if (dispositivo.valor_estimado != null) drawRow('Valor estimado', `${Number(dispositivo.valor_estimado).toFixed(2)} EUR`);
  y -= 8;

  drawSection('Datos del Receptor');
  if (empleado) {
    drawRow('Nombre completo', empleado.nombre);
    drawRow('Email',           empleado.email || '—');
    drawRow('DNI / NIF',       empleado.dni || '—');
  } else if (dispositivo.usuario_asignado_nombre) {
    drawRow('Nombre', dispositivo.usuario_asignado_nombre);
  } else {
    drawRow('Receptor', 'Sin asignar');
  }
  if (dispositivo.fecha_asignacion) drawRow('Fecha de asignacion', new Date(dispositivo.fecha_asignacion).toLocaleDateString('es-ES'));
  y -= 8;

  if (dispositivo.notas?.trim()) {
    drawSection('Notas / Observaciones');
    for (const line of wrapText(dispositivo.notas, 80).slice(0, 6)) { page.drawText(line, { x: 60, y, size: 9, font: fontNormal, color: DARK }); y -= 14; }
    y -= 4;
  }

  y -= 12;
  drawSection('Condiciones de entrega');
  const conds = [
    'El receptor declara haber recibido el dispositivo descrito en perfecto estado de funcionamiento.',
    'El dispositivo es propiedad de la empresa y debe ser utilizado exclusivamente para fines laborales.',
    'El receptor se compromete a custodiar el dispositivo y comunicar cualquier incidencia.',
    'La perdida o deterioro intencionado podra ser objeto de responsabilidad economica.',
  ];
  for (const c of conds) { for (const l of wrapText('• ' + c, 85)) { page.drawText(l, { x: 60, y, size: 8.5, font: fontNormal, color: DARK }); y -= 13; } }

  const sigY = Math.min(y - 30, 160);
  const col1 = 60; const col2 = width / 2 + 20; const lineW = (width / 2) - 80;
  page.drawLine({ start: { x: col1, y: sigY }, end: { x: col1 + lineW, y: sigY }, thickness: 0.5, color: GRAY });
  page.drawText('Firma empresa / Responsable', { x: col1, y: sigY - 14, size: 8, font: fontNormal, color: GRAY });
  page.drawText(societyName, { x: col1, y: sigY - 26, size: 7.5, font: fontNormal, color: GRAY });
  page.drawLine({ start: { x: col2, y: sigY }, end: { x: col2 + lineW, y: sigY }, thickness: 0.5, color: GRAY });
  page.drawText('Firma receptor / Empleado', { x: col2, y: sigY - 14, size: 8, font: fontNormal, color: GRAY });
  if (empleado) page.drawText(empleado.nombre, { x: col2, y: sigY - 26, size: 7.5, font: fontNormal, color: GRAY });

  page.drawRectangle({ x: 0, y: 0, width, height: 28, color: rgb(0.95, 0.96, 0.97) });
  page.drawText('Documento generado automaticamente — Portal de Gestion', { x: 40, y: 10, size: 7.5, font: fontNormal, color: GRAY });
  page.drawText(`Ref: ${dispositivo.etiquetado || dispositivo.id.slice(0, 8).toUpperCase()}`, { x: width - 120, y: 10, size: 7.5, font: fontNormal, color: GRAY });

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Entrega_${(dispositivo.marca_modelo || 'dispositivo').replace(/\s+/g, '_')}_${dispositivo.etiquetado || dispositivo.id.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Device Form Modal ─────────────────────────────────────────────────────────

interface DeviceModalProps {
  initial?: Dispositivo | null;
  empleados: Empleado[];
  sociedades: Sociedad[];
  onClose: () => void;
  onSaved: () => void;
}

function DeviceModal({ initial, empleados, sociedades, onClose, onSaved }: DeviceModalProps) {
  const [form, setForm] = useState({
    tipo:                    initial?.tipo ?? 'Portatil',
    marca_modelo:            initial?.marca_modelo ?? '',
    caracteristicas:         initial?.caracteristicas ?? '',
    centro_trabajo:          initial?.centro_trabajo ?? '',
    numero_serie:            initial?.numero_serie ?? '',
    society_id:              initial?.society_id ?? (sociedades[0]?.id ?? null) as string | null,
    empleado_id:             initial?.empleado_id ?? null as string | null,
    usuario_asignado_nombre: initial?.usuario_asignado_nombre ?? '',
    fecha_asignacion:        initial?.fecha_asignacion ?? null as string | null,
    notas:                   initial?.notas ?? '',
    etiquetado:              initial?.etiquetado ?? '' as string,
    estado_id:               initial?.estado_id ?? 1,
    valor_estimado:          initial?.valor_estimado ?? null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleEmpleadoChange = (empId: string) => {
    if (!empId) { set('empleado_id', null); set('usuario_asignado_nombre', ''); return; }
    const emp = empleados.find((e) => e.id === empId);
    set('empleado_id', empId);
    set('usuario_asignado_nombre', emp?.nombre ?? '');
  };

  const handleSave = async () => {
    if (!form.marca_modelo.trim()) { setError('La marca/modelo es obligatoria'); return; }
    setSaving(true); setError('');
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error: dbErr } = initial
      ? await supabase.from('dispositivos').update(payload).eq('id', initial.id)
      : await supabase.from('dispositivos').insert(payload);
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSaved(); onClose();
  };

  const inp  = 'w-full px-3 py-2 rounded-lg text-sm outline-none';
  const inpS = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' };
  const lbl  = 'block text-xs font-medium mb-1' ;
  const lblS = { color: '#64748B' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
            {initial ? 'Editar dispositivo' : 'Nuevo dispositivo'}
          </h2>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100">
            <X size={14} style={{ color: '#64748B' }} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: '72vh' }}>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div>
            <label className={lbl} style={lblS}>Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map((t) => {
                const Icon = TIPO_ICON[t] ?? Cpu;
                const active = form.tipo === t;
                return (
                  <button key={t} type="button" onClick={() => set('tipo', t)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ border: `1.5px solid ${active ? '#0EA5E9' : '#E2E8F0'}`, backgroundColor: active ? '#F0F9FF' : '#F8FAFC', color: active ? '#0284C7' : '#64748B' }}>
                    <Icon size={12} /> {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl} style={lblS}>Marca / Modelo *</label>
              <input value={form.marca_modelo} onChange={(e) => set('marca_modelo', e.target.value)} placeholder="Apple MacBook Pro" className={inp} style={inpS} />
            </div>
            <div>
              <label className={lbl} style={lblS}>Numero de serie</label>
              <input value={form.numero_serie} onChange={(e) => set('numero_serie', e.target.value)} placeholder="SN123456" className={inp} style={inpS} />
            </div>
            <div>
              <label className={lbl} style={lblS}>Etiquetado</label>
              <input value={form.etiquetado ?? ''} onChange={(e) => set('etiquetado', e.target.value)} placeholder="PORTA-01" className={inp} style={inpS} />
            </div>
            <div className="col-span-2">
              <label className={lbl} style={lblS}>Caracteristicas</label>
              <input value={form.caracteristicas} onChange={(e) => set('caracteristicas', e.target.value)} placeholder="16GB RAM, 512GB SSD" className={inp} style={inpS} />
            </div>
            <div>
              <label className={lbl} style={lblS}>Centro de trabajo</label>
              <input value={form.centro_trabajo} onChange={(e) => set('centro_trabajo', e.target.value)} placeholder="Oficina Madrid" className={inp} style={inpS} />
            </div>
            <div>
              <label className={lbl} style={lblS}>Valor estimado (EUR)</label>
              <input type="number" min="0" step="0.01" value={form.valor_estimado ?? ''} onChange={(e) => set('valor_estimado', e.target.value ? parseFloat(e.target.value) : null)} placeholder="0.00" className={inp} style={inpS} />
            </div>
            <div>
              <label className={lbl} style={lblS}>Estado</label>
              <select value={form.estado_id} onChange={(e) => set('estado_id', parseInt(e.target.value))} className={inp} style={inpS}>
                {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl} style={lblS}>Sociedad</label>
              <select value={form.society_id ?? ''} onChange={(e) => set('society_id', e.target.value || null)} className={inp} style={inpS}>
                <option value="">Sin sociedad</option>
                {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl} style={lblS}>Fecha asignacion</label>
              <input type="date" value={form.fecha_asignacion ?? ''} onChange={(e) => set('fecha_asignacion', e.target.value || null)} className={inp} style={inpS} />
            </div>
            <div>
              <label className={lbl} style={lblS}>Empleado asignado</label>
              <select value={form.empleado_id ?? ''} onChange={(e) => handleEmpleadoChange(e.target.value)} className={inp} style={inpS}>
                <option value="">Sin asignar</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl} style={lblS}>Notas</label>
              <textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2} className={`${inp} resize-none`} style={inpS} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            {initial ? 'Guardar' : 'Crear dispositivo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Device Row ────────────────────────────────────────────────────────────────

interface DeviceRowProps {
  d: Dispositivo;
  empleados: Empleado[];
  sociedades: Sociedad[];
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function DeviceRow({ d, empleados, sociedades, onEdit, onDelete, deleting }: DeviceRowProps) {
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const Icon = TIPO_ICON[d.tipo] ?? Cpu;
  const estado = ESTADOS[d.estado_id] ?? ESTADOS[1];
  const iconStyle = TIPO_ICON_BG[d.estado_id] ?? TIPO_ICON_BG[1];
  const empleado = empleados.find((e) => e.id === d.empleado_id) ?? null;
  const society = sociedades.find((s) => s.id === d.society_id);
  const etiqueta = d.etiquetado?.trim() || null;

  const handlePDF = async () => {
    setGeneratingPDF(true);
    try { await generateEntregaPDF(d, empleado, society?.nombre ?? 'Empresa'); }
    finally { setGeneratingPDF(false); }
  };

  return (
    <div className="grid items-center px-4 py-3 gap-3 hover:bg-slate-50 transition-colors"
      style={{ borderBottom: '1px solid #F1F5F9', gridTemplateColumns: '36px 1fr 130px 150px 160px 170px 110px 90px' }}>

      {/* Icon */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: iconStyle.bg }}>
        <Icon size={14} style={{ color: iconStyle.color }} />
      </div>

      {/* Modelo */}
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{d.marca_modelo}</p>
        <p className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{d.caracteristicas}</p>
        <span className="inline-block text-xs px-1.5 py-0.5 rounded-md mt-1"
          style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{d.tipo}</span>
      </div>

      {/* Etiqueta */}
      <div>
        {etiqueta ? (
          <span className="text-xs font-mono px-2 py-1 rounded-md"
            style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
            {etiqueta}
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-md"
            style={{ backgroundColor: '#F8FAFC', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
            S/E
          </span>
        )}
      </div>

      {/* Serie */}
      <div>
        <p className="text-xs font-mono truncate" style={{ color: '#475569' }}>
          {d.numero_serie?.trim() || '—'}
        </p>
      </div>

      {/* Asignado a */}
      <div>
        {empleado ? (
          <div className="flex items-center gap-1.5">
            <User size={11} style={{ color: '#64748B', flexShrink: 0 }} />
            <p className="text-xs truncate" style={{ color: '#0F172A' }}>{empleado.nombre}</p>
          </div>
        ) : (
          <p className="text-xs" style={{ color: '#CBD5E1' }}>Sin asignar</p>
        )}
      </div>

      {/* Centro / Sociedad */}
      <div>
        {d.centro_trabajo?.trim() && (
          <p className="text-xs font-medium truncate" style={{ color: '#475569' }}>{d.centro_trabajo.trim()}</p>
        )}
        {society && (
          <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-0.5"
            style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
            {society.nombre}
          </span>
        )}
      </div>

      {/* Estado */}
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: estado.dot }} />
        <span className="text-xs font-medium" style={{ color: estado.color }}>{estado.label}</span>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-0.5 justify-end">
        <button onClick={handlePDF} disabled={generatingPDF} title="Acta de entrega PDF"
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-sky-50 disabled:opacity-50 transition-colors">
          {generatingPDF
            ? <Loader2 size={13} className="animate-spin" style={{ color: '#0EA5E9' }} />
            : <FileDown size={13} style={{ color: '#0EA5E9' }} />}
        </button>
        <button onClick={onEdit}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors">
          <Pencil size={13} style={{ color: '#94A3B8' }} />
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50 disabled:opacity-50 transition-colors">
          {deleting
            ? <Loader2 size={13} className="animate-spin" style={{ color: '#EF4444' }} />
            : <Trash2 size={13} style={{ color: '#EF4444' }} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';

export default function DevicesModule() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterSociedad, setFilterSociedad] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Dispositivo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: devs }, { data: emps }, { data: socs }] = await Promise.all([
      supabase.from('dispositivos').select('*').order('created_at', { ascending: false }),
      supabase.from('empleados').select('id, nombre, email, dni'),
      supabase.from('sociedades').select('id, nombre').order('nombre'),
    ]);
    setDispositivos((devs ?? []) as Dispositivo[]);
    setEmpleados((emps ?? []) as Empleado[]);
    setSociedades((socs ?? []) as Sociedad[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('dispositivos').delete().eq('id', id);
    setDeleting(null);
    load();
  };

  const filtered = dispositivos.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || d.marca_modelo.toLowerCase().includes(q)
      || (d.numero_serie?.toLowerCase() ?? '').includes(q)
      || (d.etiquetado?.toLowerCase() ?? '').includes(q)
      || (d.caracteristicas?.toLowerCase() ?? '').includes(q)
      || (d.usuario_asignado_nombre?.toLowerCase() ?? '').includes(q)
      || (d.centro_trabajo?.toLowerCase() ?? '').includes(q);
    const matchTipo    = !filterTipo    || d.tipo === filterTipo;
    const matchEstado  = !filterEstado  || d.estado_id === parseInt(filterEstado);
    const matchSoc     = !filterSociedad || d.society_id === filterSociedad;
    return matchSearch && matchTipo && matchEstado && matchSoc;
  });

  // Sort by etiquetado
  const sorted = [...filtered].sort((a, b) => {
    const etA = (a.etiquetado?.trim() || 'ZZZZZ').toUpperCase();
    const etB = (b.etiquetado?.trim() || 'ZZZZZ').toUpperCase();
    return sortDir === 'asc' ? etA.localeCompare(etB) : etB.localeCompare(etA);
  });

  const activos = dispositivos.filter((d) => d.estado_id === 1).length;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Gestion de Dispositivos</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {dispositivos.length} dispositivos · {activos} activos
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
          <Plus size={14} /> Nuevo dispositivo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por modelo, serie, usuario..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }} />
        </div>
        <select value={filterSociedad} onChange={(e) => setFilterSociedad(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569' }}>
          <option value="">Todas las sociedades</option>
          {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569' }}>
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569' }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid #E2E8F0' }}>
        {/* Column headers */}
        <div className="grid px-4 py-2.5 gap-3"
          style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', gridTemplateColumns: '36px 1fr 130px 150px 160px 170px 110px 90px' }}>
          <div />
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Modelo</div>
          <button
            onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:opacity-70"
            style={{ color: '#0EA5E9' }}>
            Etiqueta
            {sortDir === 'asc'
              ? <ArrowUp size={11} />
              : <ArrowDown size={11} />}
          </button>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Serie</div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Asignado a</div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Centro / Sociedad</div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Estado</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-right" style={{ color: '#94A3B8' }}>Acciones</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={22} className="animate-spin" style={{ color: '#0EA5E9' }} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-14">
            <Laptop size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              {dispositivos.length === 0 ? 'Sin dispositivos registrados' : 'Sin resultados'}
            </p>
          </div>
        ) : (
          sorted.map((d) => (
            <DeviceRow
              key={d.id}
              d={d}
              empleados={empleados}
              sociedades={sociedades}
              onEdit={() => { setEditing(d); setShowModal(true); }}
              onDelete={() => handleDelete(d.id)}
              deleting={deleting === d.id}
            />
          ))
        )}
      </div>

      {showModal && (
        <DeviceModal
          initial={editing}
          empleados={empleados}
          sociedades={sociedades}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
