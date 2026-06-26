import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Shield, Users, Truck, FileText, Laptop, Palmtree, ShieldCheck, ScrollText, AlertCircle, Clock, Receipt, Ligature as FileSignature, Zap, Award, ClipboardCheck, BarChart2, Building2, Activity, Palette } from 'lucide-react';

type AppRole = 'rrhh' | 'supervisor' | 'prevencion' | 'administracion' | 'employee';

interface TabDef {
  id: string;
  label: string;
  icon: React.FC<{ size?: number }>;
  panel: string; // which panel this tab belongs to
}

const ALL_TABS: TabDef[] = [
  // RRHH / Supervisor panel tabs
  { id: 'overview',      label: 'Resumen',              icon: BarChart2,      panel: 'rrhh' },
  { id: 'employees',     label: 'Empleados',            icon: Users,          panel: 'rrhh' },
  { id: 'personal-docs', label: 'Documentos Personales',icon: FileText,       panel: 'rrhh' },
  { id: 'vacations',     label: 'Vacaciones',           icon: Palmtree,       panel: 'rrhh' },
  { id: 'certificates',  label: 'Certificaciones',      icon: Award,          panel: 'rrhh' },
  { id: 'exams',         label: 'Examenes',             icon: ClipboardCheck, panel: 'rrhh' },
  { id: 'users',         label: 'Gestion de Usuarios',  icon: Shield,         panel: 'rrhh' },
  { id: 'vehicles',      label: 'Vehiculos',            icon: Truck,          panel: 'rrhh' },
  { id: 'documents',     label: 'Documentos',           icon: FileText,       panel: 'rrhh' },
  { id: 'pdf-split',     label: 'Nominas',              icon: Zap,            panel: 'rrhh' },
  { id: 'audit',         label: 'Auditoria',            icon: ScrollText,     panel: 'rrhh' },
  { id: 'contratos',     label: 'Contratos',            icon: FileSignature,  panel: 'rrhh' },
  { id: 'prevencion',    label: 'Prevencion/Calidad',   icon: ShieldCheck,    panel: 'rrhh' },
  { id: 'facturas',      label: 'Facturas',             icon: Receipt,        panel: 'rrhh' },
  { id: 'incidencias',   label: 'Incidencias',          icon: AlertCircle,    panel: 'rrhh' },
  { id: 'fichajes',      label: 'Fichajes',             icon: Clock,          panel: 'rrhh' },
  // Prevencion panel tabs
  { id: 'prl-docs',      label: 'Documentos PRL',       icon: ShieldCheck,    panel: 'prevencion' },
  // Administracion panel tabs
  { id: 'admin-overview', label: 'Resumen Admin',       icon: BarChart2,      panel: 'administracion' },
];

const ROLES: { id: AppRole; label: string; color: string; bg: string; border: string }[] = [
  { id: 'rrhh',           label: 'RRHH',           color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { id: 'supervisor',     label: 'Supervisor',     color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { id: 'prevencion',     label: 'Prevencion',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'administracion', label: 'Administracion', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  { id: 'employee',       label: 'Empleado',       color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
];

// Which tabs are relevant for each role's panel
const ROLE_RELEVANT_TABS: Record<AppRole, string[]> = {
  rrhh:           ['overview', 'employees', 'personal-docs', 'vacations', 'certificates', 'exams', 'users', 'vehicles', 'documents', 'pdf-split', 'audit', 'contratos', 'prevencion', 'facturas', 'incidencias', 'fichajes'],
  supervisor:     ['overview', 'employees', 'personal-docs', 'vacations', 'certificates', 'exams', 'vehicles', 'facturas', 'incidencias', 'fichajes'],
  prevencion:     ['employees', 'documents', 'prl-docs', 'incidencias', 'fichajes'],
  administracion: ['overview', 'employees', 'documents', 'facturas', 'contratos', 'vehicles', 'personal-docs', 'incidencias', 'fichajes'],
  employee:       ['personal-docs', 'vacations', 'certificates', 'exams', 'incidencias', 'prl-docs', 'fichajes'],
};

type PermissionsMap = Record<string, Record<string, boolean>>; // role -> tabId -> enabled

export default function RoleTabPermissionsManager() {
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('rrhh');

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('role_tab_permissions')
      .select('role, tab_id, enabled');

    const map: PermissionsMap = {};
    for (const row of data ?? []) {
      if (!map[row.role]) map[row.role] = {};
      map[row.role][row.tab_id] = row.enabled;
    }

    // Fill in defaults for any missing entries
    for (const role of ROLES) {
      if (!map[role.id]) map[role.id] = {};
      for (const tabId of ROLE_RELEVANT_TABS[role.id]) {
        if (map[role.id][tabId] === undefined) {
          map[role.id][tabId] = true;
        }
      }
    }

    setPermissions(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const toggleTab = async (role: AppRole, tabId: string) => {
    const current = permissions[role]?.[tabId] ?? true;
    const next = !current;
    const key = `${role}-${tabId}`;
    setSaving(key);

    setPermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [tabId]: next },
    }));

    await supabase
      .from('role_tab_permissions')
      .upsert({ role, tab_id: tabId, enabled: next, updated_at: new Date().toISOString() }, { onConflict: 'role,tab_id' });

    setSaving(null);
  };

  const currentRole = ROLES.find(r => r.id === selectedRole)!;
  const relevantTabIds = ROLE_RELEVANT_TABS[selectedRole];
  const relevantTabs = ALL_TABS.filter(t => relevantTabIds.includes(t.id));

  const enabledCount = relevantTabs.filter(t => permissions[selectedRole]?.[t.id] ?? true).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1" style={{ color: '#0F172A' }}>Permisos de Pestanas por Perfil</h2>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Activa o desactiva las pestanas que puede ver cada perfil de usuario. Los cambios se aplican inmediatamente.
        </p>
      </div>

      {/* Role selector */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(role => (
          <button
            key={role.id}
            onClick={() => setSelectedRole(role.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: selectedRole === role.id ? role.color : role.bg,
              color: selectedRole === role.id ? '#FFFFFF' : role.color,
              border: `1px solid ${role.border}`,
            }}
          >
            {role.label}
          </button>
        ))}
      </div>

      {/* Permissions grid */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: currentRole.bg }}
            >
              <Users size={15} style={{ color: currentRole.color }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                Perfil: {currentRole.label}
              </p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                {enabledCount} de {relevantTabs.length} pestanas activas
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: currentRole.color }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {relevantTabs.map(tab => {
              const enabled = permissions[selectedRole]?.[tab.id] ?? true;
              const isSaving = saving === `${selectedRole}-${tab.id}`;
              const TabIcon = tab.icon;
              return (
                <div
                  key={tab.id}
                  className="flex items-center justify-between p-3 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: enabled ? currentRole.bg : '#F8FAFC',
                    border: `1px solid ${enabled ? currentRole.border : '#E2E8F0'}`,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TabIcon size={15} style={{ color: enabled ? currentRole.color : '#94A3B8', flexShrink: 0 }} />
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: enabled ? '#0F172A' : '#94A3B8' }}
                    >
                      {tab.label}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleTab(selectedRole, tab.id)}
                    disabled={isSaving}
                    className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200 cursor-pointer ml-2"
                    style={{
                      backgroundColor: enabled ? currentRole.color : '#CBD5E1',
                      opacity: isSaving ? 0.6 : 1,
                    }}
                    title={enabled ? 'Desactivar' : 'Activar'}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"
                      style={{ left: enabled ? '22px' : '2px' }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs" style={{ color: '#94A3B8' }}>
        Los cambios aplican la proxima vez que el usuario recargue su panel.
      </p>
    </div>
  );
}
