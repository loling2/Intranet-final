import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, MapPin, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

type Employee = { id: string; nombre: string; id_sociedad: string | null; centro_trabajo: string | null };
type Centre = { id: string; nombre: string };
type Row = { id: string; empleado_id: string | null; nombre_empleado: string; fecha: string; timestamp: string; centro_id: string | null; centro_nombre: string | null; dispositivo: string | null; kiosk_device_id: string | null; employee?: Employee; company?: string };

const csvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const download = (name: string, content: Blob) => { const url = URL.createObjectURL(content); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); };

export default function AuditoriaFichajesModule() {
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [companies, setCompanies] = useState(new Map<string, string>());
  const [view, setView] = useState<'all' | 'mobility'>('all');
  const [employeeId, setEmployeeId] = useState(''); const [centreId, setCentreId] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [fichajes, employeeResult, societyResult, centreResult] = await Promise.all([
      supabase.from('fichajes').select('id,empleado_id,nombre_empleado,fecha,timestamp,centro_id,centro_nombre,dispositivo,kiosk_device_id').order('timestamp', { ascending: false }).limit(10000),
      supabase.from('empleados').select('id,nombre,id_sociedad,centro_trabajo').order('nombre'),
      supabase.from('sociedades').select('id,nombre'),
      supabase.from('centros').select('id,nombre').order('nombre'),
    ]);
    if (fichajes.error) setError(fichajes.error.message);
    const employeeList = (employeeResult.data ?? []) as Employee[];
    const employeeMap = new Map(employeeList.map((item) => [item.id, item]));
    setEmployees(employeeList); setCentres((centreResult.data ?? []) as Centre[]); setCompanies(new Map((societyResult.data ?? []).map((item: { id: string; nombre: string }) => [item.id, item.nombre])));
    setRows(((fichajes.data ?? []) as Row[]).map((row) => ({ ...row, employee: row.empleado_id ? employeeMap.get(row.empleado_id) : undefined })));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => {
    const assigned = row.employee?.centro_trabajo?.trim().toLocaleLowerCase(); const registered = row.centro_nombre?.trim().toLocaleLowerCase();
    const isMobility = Boolean(assigned && registered && assigned !== registered);
    const haystack = `${row.nombre_empleado} ${row.centro_nombre ?? ''} ${row.dispositivo ?? ''} ${row.kiosk_device_id ?? ''}`.toLocaleLowerCase();
    return (view === 'all' || isMobility) && (!employeeId || row.empleado_id === employeeId) && (!centreId || row.centro_id === centreId) && (!from || row.fecha >= from) && (!to || row.fecha <= to) && (!search || haystack.includes(search.toLocaleLowerCase()));
  }), [rows, view, employeeId, centreId, from, to, search]);

  const exportRows = filtered.map((row) => ({ 'Fecha/Hora': new Date(row.timestamp).toLocaleString('es-ES'), Trabajador: row.employee?.nombre ?? row.nombre_empleado, Empresa: row.employee?.id_sociedad ? companies.get(row.employee.id_sociedad) ?? '' : '', 'Centro de Trabajo (donde fichó)': row.centro_nombre ?? '', 'ID Dispositivo': row.kiosk_device_id ?? row.dispositivo ?? '' }));
  const exportCsv = () => { const headers = Object.keys(exportRows[0] ?? { 'Fecha/Hora': '', Trabajador: '', Empresa: '', 'Centro de Trabajo (donde fichó)': '', 'ID Dispositivo': '' }); const body = [headers, ...exportRows.map((row) => headers.map((header) => row[header as keyof typeof row]))].map((line) => line.map(csvValue).join(';')).join('\n'); download('auditoria_fichajes.csv', new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' })); };
  const exportExcel = () => { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(exportRows), 'Fichajes'); download('auditoria_fichajes.xlsx', new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); };

  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#0F172A' }}><ShieldCheck size={19} style={{ color: '#0369A1' }} /> Auditoría e integridad de fichajes</h2><p className="text-xs mt-1" style={{ color: '#64748B' }}>Cada registro conserva la hora del servidor, el centro y la tablet de origen.</p></div><div className="flex gap-2"><button onClick={exportCsv} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#E0F2FE', color: '#0369A1' }}><Download size={14} className="inline mr-1" />CSV</button><button onClick={exportExcel} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#DCFCE7', color: '#166534' }}><FileSpreadsheet size={14} className="inline mr-1" />Excel</button><button onClick={() => void load()} className="p-2 rounded-lg" style={{ background: '#F1F5F9' }} aria-label="Actualizar"><RefreshCw size={14} /></button></div></div>
    <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#E2E8F0' }}><button onClick={() => setView('all')} className="px-3 py-2 rounded-lg text-xs" style={{ background: view === 'all' ? '#FFF' : 'transparent' }}>Todos ({rows.length})</button><button onClick={() => setView('mobility')} className="px-3 py-2 rounded-lg text-xs" style={{ background: view === 'mobility' ? '#FFF' : 'transparent' }}><MapPin size={12} className="inline mr-1" />Reporte de movilidad</button></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 p-3 rounded-xl" style={{ background: '#FFF', border: '1px solid #E2E8F0' }}><div className="relative"><Search size={14} className="absolute left-3 top-2.5" style={{ color: '#94A3B8' }} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="w-full pl-8 py-2 rounded-lg text-xs" /></div><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="px-2 py-2 rounded-lg text-xs"><option value="">Todos los trabajadores</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><select value={centreId} onChange={(event) => setCentreId(event.target.value)} className="px-2 py-2 rounded-lg text-xs"><option value="">Todos los centros</option>{centres.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="px-2 py-2 rounded-lg text-xs" /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="px-2 py-2 rounded-lg text-xs" /></div>
    {error && <p className="p-3 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{error}</p>}
    <div className="rounded-xl overflow-auto" style={{ background: '#FFF', border: '1px solid #E2E8F0' }}>{loading ? <div className="p-10 text-center"><RefreshCw className="animate-spin mx-auto" size={20} /></div> : <table className="w-full text-left text-xs"><thead style={{ background: '#F8FAFC' }}><tr>{['Fecha/Hora', 'Trabajador', 'Empresa', 'Centro donde fichó', 'Centro asignado', 'Dispositivo'].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-t" style={{ borderColor: '#F1F5F9' }}><td className="px-3 py-2 whitespace-nowrap">{new Date(row.timestamp).toLocaleString('es-ES')}</td><td className="px-3 py-2 font-medium">{row.employee?.nombre ?? row.nombre_empleado}</td><td className="px-3 py-2">{row.employee?.id_sociedad ? companies.get(row.employee.id_sociedad) : '—'}</td><td className="px-3 py-2">{row.centro_nombre ?? '—'}</td><td className="px-3 py-2">{row.employee?.centro_trabajo ?? '—'}</td><td className="px-3 py-2">{row.kiosk_device_id ?? row.dispositivo ?? '—'}</td></tr>)}</tbody></table>}</div><p className="text-xs" style={{ color: '#64748B' }}>{filtered.length} registros visibles</p>
  </div>;
}
