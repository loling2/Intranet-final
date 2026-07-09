import { useState, useEffect } from 'react';
import {
  GraduationCap, LogOut, ChevronLeft, BarChart2, ClipboardCheck, KeyRound, Menu,
  BookOpen, CheckCircle2, XCircle, Clock, Users,
} from 'lucide-react';
import ExamenesModule from './components/ExamenesModule';
import ChangePasswordModal from './components/ChangePasswordModal';
import SocietySwitcher from './SocietySwitcher';
import { supabase } from './supabaseClient';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateAdmin?: () => void;
  isAdmin?: boolean;
  onNavigateEmployee?: () => void;
}

type FormacionTab = 'overview' | 'examenes';

export default function FormacionPanel({ email, onLogout, onNavigateAdmin, isAdmin, onNavigateEmployee }: Props) {
  const [activeTab, setActiveTab] = useState<FormacionTab>('examenes');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentUserNombre, setCurrentUserNombre] = useState('');
  const [overviewStats, setOverviewStats] = useState({
    totalExamenes: 0,
    activos: 0,
    totalAsignaciones: 0,
    aprobados: 0,
    suspendidos: 0,
    pendientes: 0,
  });
  const [loadingOverview, setLoadingOverview] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      if (uid) {
        supabase.from('user_profiles').select('nombre').eq('id', uid).maybeSingle()
          .then(({ data }) => setCurrentUserNombre(data?.nombre ?? email));
      }
    });
  }, [email]);

  useEffect(() => {
    if (activeTab !== 'overview') return;
    (async () => {
      setLoadingOverview(true);
      const [{ data: exs }, { data: asigs }] = await Promise.all([
        supabase.from('examenes').select('id, estado'),
        supabase.from('examen_asignaciones').select('id, estado'),
      ]);
      setOverviewStats({
        totalExamenes: exs?.length ?? 0,
        activos: exs?.filter(e => e.estado === 'activo').length ?? 0,
        totalAsignaciones: asigs?.length ?? 0,
        aprobados: asigs?.filter(a => a.estado === 'completado').length ?? 0,
        suspendidos: asigs?.filter(a => a.estado === 'suspendido').length ?? 0,
        pendientes: asigs?.filter(a => a.estado === 'pendiente' || a.estado === 'en_curso').length ?? 0,
      });
      setLoadingOverview(false);
    })();
  }, [activeTab]);

  const tabs: { id: FormacionTab; label: string; icon: React.FC<{ size?: number }> }[] = [
    { id: 'overview', label: 'Resumen', icon: BarChart2 },
    { id: 'examenes', label: 'Examenes', icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #164E63, #0891B2)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={isAdmin && onNavigateAdmin ? onNavigateAdmin : onNavigateEmployee ?? onLogout}
              title="Volver"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#E0F2FE' }}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <GraduationCap size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm sm:text-lg tracking-tight">Panel de Formacion</h1>
              <p className="text-white/50 text-xs hidden sm:block">Gestion de examenes y resultados</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <SocietySwitcher textColor="#E0F2FE" bgColor="rgba(255,255,255,0.08)" borderColor="rgba(255,255,255,0.1)" />
            {isAdmin && onNavigateAdmin && (
              <button
                onClick={onNavigateAdmin}
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <span>Volver a Admin</span>
              </button>
            )}
            {onNavigateEmployee && (
              <button
                onClick={onNavigateEmployee}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <Users size={12} />
                <span>Mi perfil</span>
              </button>
            )}
            <div className="text-right hidden lg:block">
              <p className="text-white text-xs font-medium truncate max-w-[140px]">{currentUserNombre || email}</p>
              <p className="text-white/50 text-xs">Formacion</p>
            </div>
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#E0F2FE', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <KeyRound size={13} />
              <span className="hidden lg:inline">Cambiar Contrasena</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Mobile: Dropdown */}
        <div className="md:hidden mb-6">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <Menu size={16} style={{ color: '#64748B' }} />
            <select
              value={activeTab}
              onChange={e => setActiveTab(e.target.value as FormacionTab)}
              className="flex-1 bg-transparent text-sm font-medium outline-none cursor-pointer"
              style={{ color: '#0F172A' }}
            >
              {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Desktop: Horizontal tabs */}
        <div className="hidden md:flex gap-1 p-1 rounded-xl mb-8" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', width: 'fit-content' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? '#0891B2' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#64748B',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {loadingOverview ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: '#0891B2' }} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'Examenes', value: overviewStats.totalExamenes, color: '#0891B2', bg: '#F0F9FF', border: '#BAE6FD', icon: BookOpen },
                    { label: 'Activos', value: overviewStats.activos, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2 },
                    { label: 'Asignaciones', value: overviewStats.totalAsignaciones, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Users },
                    { label: 'Aprobados', value: overviewStats.aprobados, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2 },
                    { label: 'Suspendidos', value: overviewStats.suspendidos, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: XCircle },
                    { label: 'Pendientes', value: overviewStats.pendientes, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Clock },
                  ].map((kpi, i) => {
                    const Icon = kpi.icon;
                    return (
                      <div key={i} className="rounded-xl p-5" style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.border}` }}>
                        <Icon size={16} style={{ color: kpi.color, marginBottom: '8px' }} />
                        <p className="text-3xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                        <p className="text-xs font-medium mt-1" style={{ color: kpi.color, opacity: 0.8 }}>{kpi.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="px-6 py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F0F9FF' }}>
                      <GraduationCap size={30} style={{ color: '#0891B2' }} />
                    </div>
                    <p className="text-base font-semibold mb-2" style={{ color: '#1E293B' }}>Panel de Formacion</p>
                    <p className="text-sm max-w-md mx-auto" style={{ color: '#94A3B8' }}>
                      Gestiona examenes, asigna empleados y registra resultados desde la pestana Examenes.
                    </p>
                    <button
                      onClick={() => setActiveTab('examenes')}
                      className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mx-auto cursor-pointer transition-all"
                      style={{ backgroundColor: '#0891B2', color: '#fff' }}
                    >
                      <ClipboardCheck size={15} />
                      Ir a Examenes
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Examenes */}
        {activeTab === 'examenes' && <ExamenesModule />}
      </div>
    </div>
  );
}
