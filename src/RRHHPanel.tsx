import { useState, useEffect } from 'react';
import { Users, FileText, Palmtree, Award, ClipboardCheck, LogOut, CheckCircle2, XCircle, Clock, Search, Car, ScrollText, ChevronLeft, Zap, Ligature as FileSignature, ShieldCheck, Receipt, KeyRound, AlertCircle, Menu, BedSingle, UserCog, HelpCircle, Tablet, MonitorSmartphone, Laptop, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { mockVacations, mockCertificates, mockExams, mockDocuments } from './mockData';
import UserManagement from './UserManagement';
import VehiclesModule from './VehiclesModule';
import DocumentsModule from './DocumentsModule';
import PDFSplitModule from './PDFSplitModule';
import AuditLogPanel from './AuditLogPanel';
import SocietySwitcher from './SocietySwitcher';
import { useSociety } from './context/SocietyContext';
import VacationsModule from './components/VacationsModule';
import ChangePasswordModal from './components/ChangePasswordModal';
import EmployeesModule from './components/EmployeesModule';
import ContratosModule from './components/ContratosModule';
import PersonalDocumentsPanel from './components/PersonalDocumentsPanel';
import FacturasModule from './components/FacturasModule';
import IncidenciasModule from './components/IncidenciasModule';
import FichajesModule from './components/FichajesModule';
import CorreccionesFichajesModule from './components/CorreccionesFichajesModule';
import KioskDevicesPanel from './components/KioskDevicesPanel';
import CentrosModule from './components/CentrosModule';
import DevicesModule from './components/DevicesModule';
import BajasModule from './components/BajasModule';
import SupervisorEmpleados from './components/SupervisorEmpleados';
import HelpPanel from './components/HelpPanel';

import { supabase } from './supabaseClient';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateAdmin?: () => void;
  isAdmin?: boolean;
  isSupervisor?: boolean;
  role?: string;
  onNavigateEmployee?: () => void;
}

type RRHHTab = 'overview' | 'employees' | 'personal-docs' | 'vacations' | 'certificates' | 'exams' | 'users' | 'vehicles' | 'documents' | 'pdf-split' | 'audit' | 'contratos' | 'prevencion' | 'centros' | 'facturas' | 'incidencias' | 'fichajes' | 'kiosk-devices' | 'devices' | 'bajas' | 'supervisor-empleados' | 'ayuda';

export default function RRHHPanel({ email, onLogout, onNavigateAdmin, isAdmin, isSupervisor, role, onNavigateEmployee }: Props) {
  const [activeTab, setActiveTab] = useState<RRHHTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [filterSociety, setFilterSociety] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const { activeSocietyId, societies } = useSociety();
  const [contratosPendientes, setContratosPendientes] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserNombre, setCurrentUserNombre] = useState('');
  const [enabledTabIds, setEnabledTabIds] = useState<Set<string> | null>(null);
  const [docsEmployeeDni, setDocsEmployeeDni] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        supabase.from('user_profiles').select('nombre').eq('id', uid).maybeSingle()
          .then(({ data }) => setCurrentUserNombre(data?.nombre ?? email));
      }
    });
  }, [email]);

  // Sync filter with active society when it changes
  useEffect(() => {
    setFilterSociety(activeSocietyId);
  }, [activeSocietyId]);

  // Load contratos pendientes + avisados count
  useEffect(() => {
    (async () => {
      const { count } = await supabase.from('empleados').select('id', { count: 'exact', head: true }).in('estado_contrato', ['pendiente', 'avisado']);
      setContratosPendientes(count ?? 0);
    })();
  }, []);

  // Load tab permissions from DB for the current role
  useEffect(() => {
    const effectiveRole = isSupervisor ? 'supervisor' : (isAdmin ? 'rrhh' : (role ?? 'rrhh'));
    supabase
      .from('role_tab_permissions')
      .select('tab_id, enabled')
      .eq('role', effectiveRole)
      .then(({ data }) => {
        if (!data || data.length === 0) { setEnabledTabIds(null); return; }
        const enabled = new Set(data.filter(r => r.enabled).map(r => r.tab_id as string));
        setEnabledTabIds(enabled);
      });
  }, [role, isSupervisor]);

  const allVacations = Object.entries(mockVacations).flatMap(([sId, v]) =>
    v.requests.map((r) => ({ ...r, societyId: sId }))
  );
  const allCertificates = Object.entries(mockCertificates).flatMap(([sId, certs]) =>
    certs.map((c) => ({ ...c, societyId: sId }))
  );
  const allExams = Object.entries(mockExams).flatMap(([sId, exams]) =>
    exams.map((e) => ({ ...e, societyId: sId }))
  );
  const allDocuments = Object.entries(mockDocuments).flatMap(([sId, docs]) =>
    docs.map((d) => ({ ...d, societyId: sId }))
  );

  const vacationsPending = allVacations.filter((v) => v.status === 'pendiente');
  const examsCompleted = allExams.filter((e) => e.status === 'completado');
  const certExpiring = allCertificates.filter((c) => {
    const expiry = new Date(c.expiryDate);
    const now = new Date();
    const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 90 && diff > 0;
  });

  const allTabs: { id: RRHHTab; label: string; icon: LucideIcon; badge?: number }[] = [
    { id: 'overview', label: isSupervisor ? 'Resumen Supervisor' : 'Resumen RRHH', icon: Clock },
    { id: 'employees', label: 'Empleados', icon: Users },
    { id: 'users', label: 'Gestion de Usuarios', icon: Users },
    { id: 'prevencion', label: 'Prevencion/Calidad', icon: ShieldCheck },
    { id: 'centros', label: 'Centros', icon: Building2 },
    { id: 'vehicles', label: 'Vehiculos', icon: Car },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'personal-docs', label: 'Documentos Personales', icon: FileText },
    { id: 'pdf-split', label: 'Nominas', icon: Zap },
    { id: 'contratos', label: 'Contratos', icon: FileSignature, badge: contratosPendientes > 0 ? contratosPendientes : undefined },
    { id: 'vacations', label: 'Vacaciones', icon: Palmtree, badge: vacationsPending.length },
    { id: 'certificates', label: 'Certificaciones', icon: Award },
    { id: 'exams', label: 'Examenes', icon: ClipboardCheck },
    { id: 'facturas', label: 'Facturas', icon: Receipt },
    { id: 'audit', label: 'Auditoria', icon: ScrollText },
    { id: 'incidencias', label: 'Incidencias', icon: AlertCircle },
    { id: 'fichajes', label: 'Fichajes', icon: Clock },
    { id: 'devices', label: 'Dispositivos', icon: Laptop },
    { id: 'kiosk-devices', label: 'Tablets Kiosco', icon: Tablet },
    { id: 'bajas', label: 'Bajas/Ausencias', icon: BedSingle },
    { id: 'supervisor-empleados', label: 'Empleados Asignados', icon: UserCog },
    { id: 'ayuda', label: 'Ayuda', icon: HelpCircle },
  ];

  const supervisorTabIds: RRHHTab[] = ['overview', 'employees', 'vehicles', 'devices', 'vacations', 'certificates', 'exams', 'fichajes', 'supervisor-empleados', 'ayuda'];

  const tabs = enabledTabIds !== null
    ? allTabs.filter(t => t.id === 'ayuda' || enabledTabIds.has(t.id))
    : isSupervisor
      ? allTabs.filter(t => supervisorTabIds.includes(t.id))
      : allTabs;

  const getSociety = (id: string) => societies.find((s) => s.id === id);

  const filteredVacations = allVacations.filter((v) =>
    (!filterSociety || v.societyId === filterSociety) &&
    (!filterStatus || v.status === filterStatus) &&
    (!searchQuery || v.reason.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCerts = allCertificates.filter((c) =>
    (!filterSociety || c.societyId === filterSociety) &&
    (!searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredExams = allExams.filter((e) =>
    (!filterSociety || e.societyId === filterSociety) &&
    (!filterStatus || e.status === filterStatus) &&
    (!searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const supervisorTheme = isSupervisor
    ? { headerBg: 'linear-gradient(135deg, #4C1D95, #7C3AED)', activeTabColor: '#7C3AED', badgeBg: '#EDE9FE', badgeColor: '#6D28D9', headerText: '#EDE9FE', panelTitle: 'Panel de Supervisor', panelSubtitle: 'Supervision de empleados y gestion operativa' }
    : { headerBg: 'linear-gradient(135deg, #0C4A6E, #0369A1)', activeTabColor: '#0369A1', badgeBg: '#DBEAFE', badgeColor: '#1D4ED8', headerText: '#E0F2FE', panelTitle: 'Panel de Recursos Humanos', panelSubtitle: 'Gestion de empleados y formacion' };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      <header
        className="sticky top-0 z-50"
        style={{ background: supervisorTheme.headerBg, borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Universal back button */}
            <button
              onClick={isAdmin && onNavigateAdmin ? onNavigateAdmin : onNavigateEmployee ?? onLogout}
              title={isAdmin && onNavigateAdmin ? 'Volver a Admin' : 'Volver al panel de empleado'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: supervisorTheme.headerText }}
            >
              <ChevronLeft size={16} />
            </button>
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              {isSupervisor ? <UserCog size={18} className="text-white" /> : <Users size={18} className="text-white" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm sm:text-lg tracking-tight">{supervisorTheme.panelTitle}</h1>
              <p className="text-white/50 text-xs hidden sm:block">{supervisorTheme.panelSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <SocietySwitcher textColor={supervisorTheme.headerText} bgColor="rgba(255,255,255,0.08)" borderColor="rgba(255,255,255,0.1)" />
            {/* Kiosk mode button */}
            <button
              onClick={() => { window.location.hash = 'kiosco'; }}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(34,211,238,0.12)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}
              title="Abrir pantalla de kiosco de fichaje"
            >
              <MonitorSmartphone size={12} />
              <span className="hidden lg:inline">Modo Kiosco</span>
            </button>
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
                <span>Mi perfil empleado</span>
              </button>
            )}
            <div className="text-right hidden lg:block">
              <p className="text-white text-xs font-medium truncate max-w-[140px]">{email}</p>
              <p className="text-white/50 text-xs">{isAdmin ? 'Admin / RRHH' : isSupervisor ? 'Supervisor' : 'RRHH'}</p>
            </div>
            {isSupervisor && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#EDE9FE', border: '1px solid rgba(255,255,255,0.2)' }}>
                <ShieldCheck size={12} />
                Supervisor
              </span>
            )}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#E0F2FE', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <KeyRound size={13} />
              <span className="hidden lg:inline">Cambiar Contrasena</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Tab Navigation */}
        {/* Mobile: Dropdown select */}
        <div className="md:hidden mb-6">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
          >
            <Menu size={16} style={{ color: '#64748B' }} />
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as RRHHTab)}
              className="flex-1 bg-transparent text-sm font-medium outline-none cursor-pointer"
              style={{ color: '#0F172A' }}
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}{tab.badge != null && tab.badge > 0 ? ` (${tab.badge})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* Desktop: Horizontal tabs */}
        <div
          className="hidden md:flex flex-wrap gap-1 p-1 rounded-xl mb-8"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
        >
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? supervisorTheme.activeTabColor : 'transparent',
                  color: isActive ? '#FFFFFF' : '#64748B',
                }}
              >
                <TabIcon size={15} />
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span
                    className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : supervisorTheme.badgeBg,
                      color: isActive ? '#FFFFFF' : supervisorTheme.badgeColor,
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Help Tab */}
        {activeTab === 'ayuda' && (
          <HelpPanel currentProfileName={isSupervisor ? 'Supervisor' : 'RRHH'} accentColor={isSupervisor ? '#7C3AED' : '#0369A1'} />
        )}

        {/* Overview */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Cards */}
            <div className={`grid grid-cols-2 ${isSupervisor ? 'sm:grid-cols-4' : 'sm:grid-cols-5'} gap-4 mb-8`}>
              {[
                { label: 'Total Empleados', value: '—', sub: 'ver pestana Empleados', color: isSupervisor ? '#7C3AED' : '#0369A1', bg: isSupervisor ? '#F5F3FF' : '#EFF6FF', border: isSupervisor ? '#DDD6FE' : '#BFDBFE', onClick: undefined },
                { label: 'Vacaciones pendientes', value: vacationsPending.length, sub: 'requieren aprobacion', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', onClick: undefined },
                { label: 'Examenes aprobados', value: examsCompleted.length, sub: 'este periodo', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', onClick: undefined },
                { label: 'Certificados por vencer', value: certExpiring.length, sub: 'en menos de 90 dias', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', onClick: undefined },
                ...(!isSupervisor ? [{ label: 'Contratos pendientes', value: contratosPendientes, sub: 'pendiente o avisado', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', onClick: () => setActiveTab('contratos') as const }] : []),
              ].map((kpi, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 transition-all duration-200"
                  style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.border}`, cursor: kpi.onClick ? 'pointer' : 'default' }}
                  onClick={kpi.onClick}
                >
                  {i === 4 && <FileSignature size={16} style={{ color: kpi.color, marginBottom: '6px' }} />}
                  <p className="text-3xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: kpi.color }}>{kpi.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: kpi.color, opacity: 0.7 }}>{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Pending vacations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <div className="flex items-center gap-2">
                    <Palmtree size={16} style={{ color: '#D97706' }} />
                    <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Vacaciones Pendientes de Aprobacion</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                    {vacationsPending.length}
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                  {vacationsPending.slice(0, 5).map((vac, i) => {
                    const s = getSociety(vac.societyId);
                    return (
                      <div key={i} className="px-6 py-3.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
                          <Clock size={14} style={{ color: '#D97706' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold" style={{ color: '#1E293B' }}>{vac.from} &rarr; {vac.to} ({vac.days}d)</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>{vac.reason}</p>
                        </div>
                        {s && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0" style={{ backgroundColor: s.primaryLight, color: s.primary, border: `1px solid ${s.border}` }}>
                            {s.name}
                          </span>
                        )}
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                            <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
                          </button>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                            <XCircle size={13} style={{ color: '#DC2626' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {vacationsPending.length === 0 && (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm" style={{ color: '#94A3B8' }}>No hay solicitudes pendientes</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Certs expiring */}
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <div className="flex items-center gap-2">
                    <Award size={16} style={{ color: '#DC2626' }} />
                    <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Certificados Proximos a Vencer</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                    {certExpiring.length}
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                  {certExpiring.slice(0, 5).map((cert, i) => {
                    const s = getSociety(cert.societyId);
                    const daysLeft = Math.ceil((new Date(cert.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={i} className="px-6 py-3.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF2F2' }}>
                          <Award size={14} style={{ color: '#DC2626' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{cert.title}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>Vence: {cert.expiryDate}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: daysLeft <= 30 ? '#FEF2F2' : '#FFFBEB', color: daysLeft <= 30 ? '#DC2626' : '#D97706' }}>
                            {daysLeft}d
                          </span>
                          {s && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: s.primaryLight, color: s.primary, border: `1px solid ${s.border}` }}>
                              {s.logoLetter}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {certExpiring.length === 0 && (
                    <div className="px-6 py-8 text-center">
                      <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: '#16A34A' }} />
                      <p className="text-sm" style={{ color: '#94A3B8' }}>Todos los certificados estan vigentes</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Society breakdown */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Resumen por Sociedad</h3>
              </div>
              <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                {societies.map((s) => {
                  const vacs = mockVacations[s.id];
                  const certs = mockCertificates[s.id] ?? [];
                  const exams = mockExams[s.id] ?? [];
                  const docs = mockDocuments[s.id] ?? [];
                  const passRate = exams.filter((e) => e.status === 'completado').length;
                  return (
                    <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.primary}15` }}>
                        <span className="text-sm font-bold" style={{ color: s.primary }}>{s.logoLetter}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{s.name}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-6 text-center">
                        <div>
                          <p className="text-sm font-bold" style={{ color: '#0369A1' }}>{docs.length}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>Docs</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: '#D97706' }}>{vacs?.requests.filter((r) => r.status === 'pendiente').length ?? 0}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>Vac. pendientes</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{passRate}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>Exams aprobados</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: '#EC4899' }}>{certs.length}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>Certificados</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Employees Tab — Supabase-backed */}
        {activeTab === 'employees' && (
          <EmployeesModule currentUserRole={isSupervisor ? 'supervisor' : (isAdmin ? 'admin' : 'rrhh')} />
        )}

        {/* Vacations Tab — Supabase-backed */}
        {activeTab === 'vacations' && (
          <VacationsModule role={isSupervisor ? 'supervisor' : (isAdmin ? 'admin' : 'rrhh')} />
        )}
        {activeTab === 'personal-docs' && <PersonalDocumentsPanel isRrhh={true} initialEmployeeDni={docsEmployeeDni} />}
        {/* Certificates Tab */}
        {activeTab === 'certificates' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <h3 className="font-semibold" style={{ color: '#0F172A' }}>Certificaciones de Empleados</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{filteredCerts.length} certificados</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: '180px' }}
                  />
                </div>
                <select
                  value={filterSociety}
                  onChange={(e) => setFilterSociety(e.target.value)}
                  className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
                >
                  <option value="">Todas las sociedades</option>
                  {societies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {filteredCerts.map((cert, i) => {
                const s = getSociety(cert.societyId);
                const isExpired = new Date(cert.expiryDate) < new Date();
                const isExpiring = (() => {
                  const d = (new Date(cert.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
                  return d <= 90 && d > 0;
                })();
                return (
                  <div key={i} className="px-6 py-4 flex items-center gap-4">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: isExpired ? '#FEF2F2' : isExpiring ? '#FFFBEB' : '#F0FDF4' }}
                    >
                      <Award size={15} style={{ color: isExpired ? '#DC2626' : isExpiring ? '#D97706' : '#16A34A' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{cert.title}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{cert.issuer} &middot; {cert.category}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-medium" style={{ color: isExpired ? '#DC2626' : isExpiring ? '#D97706' : '#16A34A' }}>
                          {isExpired ? 'Expirado' : isExpiring ? 'Por vencer' : 'Vigente'}
                        </p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{cert.expiryDate}</p>
                      </div>
                      {s && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: s.primaryLight, color: s.primary, border: `1px solid ${s.border}` }}>
                          {s.logoLetter}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Exams Tab */}
        {activeTab === 'exams' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <h3 className="font-semibold" style={{ color: '#0F172A' }}>Resultados de Examenes</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{filteredExams.length} examenes</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: '160px' }}
                  />
                </div>
                <select
                  value={filterSociety}
                  onChange={(e) => setFilterSociety(e.target.value)}
                  className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
                >
                  <option value="">Todas</option>
                  {societies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
                >
                  <option value="">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_curso">En curso</option>
                  <option value="completado">Aprobado</option>
                  <option value="suspendido">Suspendido</option>
                </select>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {filteredExams.map((exam, i) => {
                const s = getSociety(exam.societyId);
                const statusColors = {
                  pendiente: { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
                  en_curso: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
                  completado: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
                  suspendido: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
                };
                const sc = statusColors[exam.status];
                return (
                  <div key={i} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sc.bg }}>
                      <ClipboardCheck size={15} style={{ color: sc.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{exam.title}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{exam.course} &middot; {exam.date}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {exam.score !== null && (
                        <span className="text-sm font-bold" style={{ color: exam.score >= 60 ? '#16A34A' : '#DC2626' }}>
                          {exam.score}%
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                        {exam.status.replace('_', ' ')}
                      </span>
                      {s && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: s.primaryLight, color: s.primary, border: `1px solid ${s.border}` }}>
                          {s.logoLetter}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contratos Tab */}
        {activeTab === 'contratos' && (
          <ContratosModule currentUserRole={isAdmin ? 'admin' : 'rrhh'} />
        )}

        {/* Users Tab - NEW */}
        {activeTab === 'users' && (
          <UserManagement currentUserRole="rrhh" />
        )}

        {/* Vehicles Tab - NEW */}
        {activeTab === 'vehicles' && (
          <VehiclesModule currentUserRole="rrhh" userEmail={email} />
        )}

        {/* Documents Tab - NEW */}
        {activeTab === 'documents' && (
          <DocumentsModule currentUserRole="rrhh" userEmail={email} />
        )}

        {/* PDF Split Tab - NEW */}
        {activeTab === 'pdf-split' && (
          <PDFSplitModule />
        )}

        {/* Audit Tab - NEW */}
        {activeTab === 'audit' && (
          <AuditLogPanel />
        )}
        {/* Facturas Tab */}
        {activeTab === 'facturas' && (
          <FacturasModule isAdmin={false} />
        )}

        {/* Incidencias Tab */}
        {activeTab === 'incidencias' && currentUserId && (
          <IncidenciasModule
            currentUserId={currentUserId}
            currentUserNombre={currentUserNombre || email}
            currentUserRole="rrhh"
          />
        )}

        {/* Fichajes Tab */}
        {activeTab === 'fichajes' && (
          <div className="space-y-6">
            <CorreccionesFichajesModule />
            <FichajesModule />
          </div>
        )}

        {/* Devices Tab */}
        {activeTab === 'devices' && (
          <DevicesModule />
        )}

        {/* Kiosk Devices Tab */}
        {activeTab === 'kiosk-devices' && (
          <KioskDevicesPanel />
        )}

        {/* Bajas/Ausencias Tab */}
        {activeTab === 'bajas' && (
          <BajasModule onViewEmployeeDocs={(dni) => { setDocsEmployeeDni(dni); setActiveTab('personal-docs'); }} />
        )}

        {/* Supervisor: Empleados Asignados Tab */}
        {activeTab === 'supervisor-empleados' && (
          <SupervisorEmpleados />
        )}

        {/* Centros Tab */}
        {activeTab === 'centros' && (
          <CentrosModule />
        )}

        {/* Prevencion/Calidad Tab */}
        {activeTab === 'prevencion' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Evaluaciones activas', value: 0, color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
                { label: 'Incidencias abiertas', value: 0, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                { label: 'Auditorias programadas', value: 0, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                { label: 'Acciones correctivas', value: 0, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
              ].map((kpi, i) => (
                <div key={i} className="rounded-xl p-5" style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.border}` }}>
                  <p className="text-3xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: kpi.color }}>{kpi.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <ShieldCheck size={16} style={{ color: '#0369A1' }} />
                <h3 className="font-semibold" style={{ color: '#0F172A' }}>Modulo de Prevencion y Calidad</h3>
              </div>
              <div className="px-6 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#EFF6FF' }}>
                  <ShieldCheck size={32} style={{ color: '#0369A1' }} />
                </div>
                <p className="text-base font-semibold mb-2" style={{ color: '#1E293B' }}>Modulo en desarrollo</p>
                <p className="text-sm max-w-md mx-auto" style={{ color: '#94A3B8' }}>
                  Aqui se gestionaran evaluaciones de riesgos, registro de incidencias, auditorias internas
                  y acciones correctivas y preventivas (ACAP) para todas las sociedades.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {['Evaluacion de Riesgos', 'Registro de Incidencias', 'Auditorias Internas', 'Planes de Accion', 'Indicadores PRL', 'Documentacion ISO'].map((item) => (
                    <span key={item} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
