import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, BarChart3, FileText, Users, Activity, Heart, Pill, ClipboardList, Calendar } from 'lucide-react';

interface Props {
  centros: { id: string; nombre: string }[];
}

interface Stats {
  totalResidentes: number;
  seguimientosHoy: number;
  incidenciasAbiertas: number;
  incidenciasSanitariasAbiertas: number;
  medicamentosActivos: number;
  actividadesMes: number;
  sesionesMes: number;
  pautasActivas: number;
  planesActivos: number;
  actasMes: number;
}

export default function CrmEstadisticasModule({ centros }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCentro, setFilterCentro] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    // Run queries in parallel
    const [residentesRes, segRes, incRes, incSanRes, medRes, actRes, sesRes, pautasRes, paiRes, actasRes] = await Promise.all([
      supabase.rpc('get_my_crm_pacientes'),
      supabase.from('crm_seguimiento_diario').select('id', { count: 'exact', head: true }).eq('fecha', today),
      supabase.from('crm_incidencias').select('id', { count: 'exact', head: true }).neq('estado', 'resuelta'),
      supabase.from('crm_incidencias_sanitarias').select('id', { count: 'exact', head: true }).eq('estado', 'abierta'),
      supabase.from('crm_medicacion').select('id', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('crm_actividades').select('id', { count: 'exact', head: true }).gte('fecha', monthStart),
      supabase.from('crm_sesiones').select('id', { count: 'exact', head: true }).gte('fecha', monthStart),
      supabase.from('crm_pautas').select('id', { count: 'exact', head: true }).eq('activa', true),
      supabase.from('crm_pai').select('id', { count: 'exact', head: true }).eq('estado', 'activo'),
      supabase.from('crm_actas').select('id', { count: 'exact', head: true }).gte('fecha', monthStart),
    ]);

    setStats({
      totalResidentes: (residentesRes.data as unknown[] | null)?.length ?? 0,
      seguimientosHoy: segRes.count ?? 0,
      incidenciasAbiertas: incRes.count ?? 0,
      incidenciasSanitariasAbiertas: incSanRes.count ?? 0,
      medicamentosActivos: medRes.count ?? 0,
      actividadesMes: actRes.count ?? 0,
      sesionesMes: sesRes.count ?? 0,
      pautasActivas: pautasRes.count ?? 0,
      planesActivos: paiRes.count ?? 0,
      actasMes: actasRes.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;

  const kpis = [
    { label: 'Residentes totales', value: stats?.totalResidentes ?? '—', color: '#0369A1', bg: '#EFF6FF', icon: Users },
    { label: 'Seguimientos hoy', value: stats?.seguimientosHoy ?? '—', color: '#16A34A', bg: '#F0FDF4', icon: Activity },
    { label: 'Incidencias abiertas', value: stats?.incidenciasAbiertas ?? '—', color: '#D97706', bg: '#FFFBEB', icon: BarChart3 },
    { label: 'Inc. sanitarias abiertas', value: stats?.incidenciasSanitariasAbiertas ?? '—', color: '#DC2626', bg: '#FEF2F2', icon: Heart },
    { label: 'Medicamentos activos', value: stats?.medicamentosActivos ?? '—', color: '#0369A1', bg: '#EFF6FF', icon: Pill },
    { label: 'Actividades este mes', value: stats?.actividadesMes ?? '—', color: '#16A34A', bg: '#F0FDF4', icon: Calendar },
    { label: 'Sesiones este mes', value: stats?.sesionesMes ?? '—', color: '#7C3AED', bg: '#F5F3FF', icon: FileText },
    { label: 'Pautas activas', value: stats?.pautasActivas ?? '—', color: '#D97706', bg: '#FFFBEB', icon: ClipboardList },
    { label: 'PAI/PIE activos', value: stats?.planesActivos ?? '—', color: '#0369A1', bg: '#EFF6FF', icon: FileText },
    { label: 'Actas este mes', value: stats?.actasMes ?? '—', color: '#475569', bg: '#F1F5F9', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Estadísticas y actividad</h2>
        <p className="text-sm" style={{ color: '#64748B' }}>Resumen general de actividad profesional e intervenciones</p>
      </div>

      {loading ? (
        <div className="text-center py-12"><Clock size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div key={i} className="rounded-xl p-5" style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.color}20` }}>
                <Icon size={18} style={{ color: kpi.color, marginBottom: '8px' }} />
                <p className="text-3xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-xs font-semibold mt-1" style={{ color: kpi.color }}>{kpi.label}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl p-6" style={cardStyle}>
        <h3 className="font-semibold text-sm mb-4" style={{ color: '#0F172A' }}>Informes y exportación</h3>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Los datos de cada módulo (seguimiento, incidencias, sesiones, medicación, ABVD, etc.) pueden consultarse y filtrarse desde la ficha de cada residente.
          Las estadísticas se calculan en tiempo real a partir de los registros existentes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Seguimientos diarios', desc: 'Registros por fecha y turno', icon: Activity, color: '#16A34A' },
            { label: 'Incidencias', desc: 'Por estado, tipo y centro', icon: BarChart3, color: '#D97706' },
            { label: 'Sesiones profesionales', desc: 'Por tipo y profesional', icon: FileText, color: '#7C3AED' },
            { label: 'Medicación', desc: 'Activos y administraciones', icon: Pill, color: '#0369A1' },
            { label: 'ABVD', desc: 'Registros de vida diaria', icon: Heart, color: '#DC2626' },
            { label: 'Actividades', desc: 'Talleres y participación', icon: Calendar, color: '#16A34A' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <Icon size={16} style={{ color: item.color, marginBottom: '6px' }} />
                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{item.label}</p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
