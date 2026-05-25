import { useState, useEffect } from 'react';
import {
  Users, FileText, Palmtree, Award, ClipboardCheck,
  LogOut, CheckCircle2, XCircle, Clock, Search,
  Calendar, ChevronRight, Lock, Car, ScrollText, TrendingUp, ChevronLeft, Zap
} from 'lucide-react';
import { societies } from './themes';
import { validUsers, mockDocuments, mockVacations, mockCertificates, mockExams } from './mockData';
import UserManagement from './UserManagement';
import VehiclesModule from './VehiclesModule';
import DocumentsModule from './DocumentsModule';
import PDFSplitModule from './PDFSplitModule';
import AuditLogPanel from './AuditLogPanel';
import SocietySwitcher from './SocietySwitcher';
import { useSociety } from './context/SocietyContext';
import EmployeeDocumentsSection from './components/EmployeeDocumentsSection';
import VacationsModule from './components/VacationsModule';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateAdmin?: () => void;
  isAdmin?: boolean;
}

type RRHHTab = 'overview' | 'employees' | 'vacations' | 'certificates' | 'exams' | 'users' | 'vehicles' | 'documents' | 'pdf-split' | 'audit';

export default function RRHHPanel({ email, onLogout, onNavigateAdmin, isAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<RRHHTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSociety, setFilterSociety] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const { activeSocietyId } = useSociety();

  // Sync filter with active society when it changes
  useEffect(() => {
    setFilterSociety(activeSocietyId);
  }, [activeSocietyId]);

  const employees = validUsers.filter((u) => u.role === 'employee');

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

  const tabs: { id: RRHHTab; label: string; icon: React.FC<{ size?: number }>; badge?: number }[] = [
    { id: 'overview', label: 'Resumen RRHH', icon: Clock },
    { id: 'employees', label: 'Empleados', icon: Users },
    { id: 'users', label: 'Gestion de Usuarios', icon: Users },
    { id: 'vehicles', label: 'Vehiculos', icon: Car },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'pdf-split', label: 'Separador de PDFs', icon: Zap },
    { id: 'vacations', label: 'Vacaciones', icon: Palmtree, badge: vacationsPending.length },
    { id: 'certificates', label: 'Certificaciones', icon: Award },
    { id: 'exams', label: 'Examenes', icon: ClipboardCheck },
    { id: 'audit', label: 'Auditoria', icon: ScrollText },
  ];

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Universal back button */}
            <button
              onClick={isAdmin && onNavigateAdmin ? onNavigateAdmin : onLogout}
              title={isAdmin && onNavigateAdmin ? 'Volver a Admin' : 'Volver al inicio'}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#E0F2FE' }}
            >
              <ChevronLeft size={18} />
            </button>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Panel de Recursos Humanos</h1>
              <p className="text-white/50 text-xs">Gestion de empleados y formacion</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SocietySwitcher textColor="#E0F2FE" bgColor="rgba(255,255,255,0.08)" borderColor="rgba(255,255,255,0.1)" />
            {isAdmin && onNavigateAdmin && (
              <button
                onClick={onNavigateAdmin}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <span>Volver a Admin</span>
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium">{email}</p>
              <p className="text-white/50 text-xs">{isAdmin ? 'Admin / RRHH' : 'RRHH'}</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-8 overflow-x-auto"
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
                  backgroundColor: isActive ? '#0369A1' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#64748B',
                }}
              >
                <TabIcon size={15} />
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span
                    className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#DBEAFE',
                      color: isActive ? '#FFFFFF' : '#1D4ED8',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Empleados', value: employees.length, sub: 'en todas las sociedades', color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
                { label: 'Vacaciones pendientes', value: vacationsPending.length, sub: 'requieren aprobacion', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                { label: 'Examenes aprobados', value: examsCompleted.length, sub: 'este periodo', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
                { label: 'Certificados por vencer', value: certExpiring.length, sub: 'en menos de 90 dias', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 transition-all duration-200"
                  style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.border}` }}
                >
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

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <h3 className="font-semibold" style={{ color: '#0F172A' }}>Directorio de Empleados</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{employees.length} empleados</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Buscar empleado..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: '220px' }}
                />
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {employees
                .filter((u) => !searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((user, i) => {
                  const s = user.societyId ? getSociety(user.societyId) : null;
                  const userDocs = user.societyId ? (mockDocuments[user.societyId]?.length ?? 0) : 0;
                  const userCerts = user.societyId ? (mockCertificates[user.societyId]?.length ?? 0) : 0;
                  const userVacs = user.societyId ? (mockVacations[user.societyId]?.balance) : null;
                  const isExpanded = expandedEmployee === user.email;
                  return (
                    <div key={i}>
                      <button
                        onClick={() => setExpandedEmployee(isExpanded ? null : user.email)}
                        className="w-full px-6 py-4 flex items-center gap-4 text-left transition-colors duration-150 cursor-pointer hover:bg-slate-50"
                      >
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                          style={{ backgroundColor: s ? `${s.primary}15` : '#F1F5F9', color: s ? s.primary : '#64748B', fontSize: '16px' }}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{user.name}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>{user.email}</p>
                        </div>
                        <div className="hidden md:flex items-center gap-4 text-center">
                          <div>
                            <p className="text-sm font-bold" style={{ color: '#0369A1' }}>{userDocs}</p>
                            <p className="text-xs" style={{ color: '#94A3B8' }}>Docs</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{userVacs ? userVacs.total - userVacs.used - userVacs.pending : 0}</p>
                            <p className="text-xs" style={{ color: '#94A3B8' }}>Vac. disp.</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: '#EC4899' }}>{userCerts}</p>
                            <p className="text-xs" style={{ color: '#94A3B8' }}>Certs</p>
                          </div>
                        </div>
                        {s && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0" style={{ backgroundColor: s.primaryLight, color: s.primary, border: `1px solid ${s.border}` }}>
                            {s.name}
                          </span>
                        )}
                        <TrendingUp size={14} className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} style={{ color: '#94A3B8' }} />
                      </button>
                      {isExpanded && user.societyId && (
                        <div className="px-6 pb-5 pt-2" style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                          <EmployeeDocumentsSection
                            employeeId={user.email}
                            employeeNombre={user.name}
                            societyId={user.societyId}
                            viewerRole={isAdmin ? 'admin' : 'rrhh'}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Vacations Tab — Supabase-backed */}
        {activeTab === 'vacations' && (
          <VacationsModule role={isAdmin ? 'admin' : 'rrhh'} />
        )}

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
      </div>
    </div>
  );
}
