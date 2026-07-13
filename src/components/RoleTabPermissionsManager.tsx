import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Shield, Users, Truck, FileText, Palmtree, ShieldCheck, ScrollText,
  AlertCircle, Clock, Receipt, Ligature as FileSignature, Zap, Award,
  ClipboardCheck, BarChart2, Plus, Trash2, X, Check,
} from 'lucide-react';

type AppRole = 'rrhh' | 'supervisor' | 'prevencion' | 'administracion' | 'employee' | string;

interface TabDef {
  id: string;
  label: string;
  icon: React.FC<{ size?: number }>;
}

const ALL_TABS: TabDef[] = [
  { id: 'overview',       label: 'Resumen',               icon: BarChart2 },
  { id: 'employees',      label: 'Empleados',             icon: Users },
  { id: 'personal-docs',  label: 'Documentos Personales', icon: FileText },
  { id: 'vacations',      label: 'Vacaciones',            icon: Palmtree },
  { id: 'certificates',   label: 'Certificaciones',       icon: Award },
  { id: 'exams',          label: 'Examenes',              icon: ClipboardCheck },
  { id: 'users',          label: 'Gestion de Usuarios',   icon: Shield },
  { id: 'vehicles',       label: 'Vehiculos',             icon: Truck },
  { id: 'documents',      label: 'Documentos',            icon: FileText },
  { id: 'pdf-split',      label: 'Nominas',               icon: Zap },
  { id: 'audit',          label: 'Auditoria',             icon: ScrollText },
  { id: 'contratos',      label: 'Contratos',             icon: FileSignature },
  { id: 'prevencion',     label: 'Prevencion/Calidad',    icon: ShieldCheck },
  { id: 'misdocumentos',  label: 'Mis Documentos',         icon: FileText },
  { id: 'calidad',        label: 'Calidad',                icon: ShieldCheck },
  { id: 'facturas',       label: 'Facturas',              icon: Receipt },
  { id: 'incidencias',    label: 'Incidencias',           icon: AlertCircle },
  { id: 'fichajes',       label: 'Fichajes',              icon: Clock },
  { id: 'prl-docs',       label: 'Documentos PRL',        icon: ShieldCheck },
];

interface RoleDef {
  id: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  isBuiltIn: boolean;
}

const BUILT_IN_ROLES: RoleDef[] = [
  { id: 'rrhh',           label: 'RRHH',           color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', isBuiltIn: true },
  { id: 'supervisor',     label: 'Supervisor',     color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', isBuiltIn: true },
  { id: 'prevencion',     label: 'Prevencion',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', isBuiltIn: true },
  { id: 'calidad',        label: 'Calidad',         color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE', isBuiltIn: true },
  { id: 'administracion', label: 'Administracion', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', isBuiltIn: true },
  { id: 'employee',       label: 'Empleado',       color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', isBuiltIn: true },
];

const CUSTOM_PALETTE = [
  { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  { color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  { color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' },
  { color: '#BE123C', bg: '#FFF1F2', border: '#FECDD3' },
  { color: '#6D28D9', bg: '#F5F3FF', border: '#C4B5FD' },
  { color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4' },
  { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  { color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
];

type PermissionsMap = Record<string, Record<string, boolean>>;

interface NewProfileForm {
  label: string;
  colorIdx: number;
}

export default function RoleTabPermissionsManager() {
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [roles, setRoles] = useState<RoleDef[]>(BUILT_IN_ROLES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('rrhh');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<NewProfileForm>({ label: '', colorIdx: 0 });
  const [creating, setCreating] = useState(false);
  const [deletingRole, setDeletingRole] = useState<string | null>(null);
  const [newFormError, setNewFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);

    const [{ data: permData }, { data: customData }] = await Promise.all([
      supabase.from('role_tab_permissions').select('role, tab_id, enabled'),
      supabase.from('custom_profiles').select('id, label, color').order('created_at'),
    ]);

    // Build permissions map
    const map: PermissionsMap = {};
    for (const row of permData ?? []) {
      if (!map[row.role]) map[row.role] = {};
      map[row.role][row.tab_id] = row.enabled;
    }
    setPermissions(map);

    // Build custom roles list
    const customRoles: RoleDef[] = (customData ?? []).map((r) => {
      const paletteEntry = CUSTOM_PALETTE.find(p => p.color === r.color) ?? CUSTOM_PALETTE[0];
      return {
        id: r.id,
        label: r.label,
        color: r.color,
        bg: paletteEntry.bg,
        border: paletteEntry.border,
        isBuiltIn: false,
      };
    });
    setRoles([...BUILT_IN_ROLES, ...customRoles]);

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleTab = async (role: string, tabId: string) => {
    const current = permissions[role]?.[tabId] ?? false;
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

  const handleCreateProfile = async () => {
    const label = newForm.label.trim();
    if (!label) { setNewFormError('Introduce un nombre'); return; }

    // Generate a slug id from label
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now().toString(36);
    const palette = CUSTOM_PALETTE[newForm.colorIdx];

    setCreating(true);
    setNewFormError('');
    const { error } = await supabase.from('custom_profiles').insert({ id, label, color: palette.color });
    if (error) { setNewFormError(error.message); setCreating(false); return; }

    await loadData();
    setSelectedRole(id);
    setShowNewForm(false);
    setNewForm({ label: '', colorIdx: 0 });
    setCreating(false);
  };

  const handleDeleteProfile = async (roleId: string) => {
    setDeletingRole(roleId);
    await supabase.from('role_tab_permissions').delete().eq('role', roleId);
    await supabase.from('custom_profiles').delete().eq('id', roleId);
    await loadData();
    setSelectedRole('rrhh');
    setDeletingRole(null);
  };

  const currentRole = roles.find(r => r.id === selectedRole) ?? roles[0];
  const enabledCount = ALL_TABS.filter(t => permissions[selectedRole]?.[t.id]).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1" style={{ color: '#0F172A' }}>Permisos de Pestanas por Perfil</h2>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Activa o desactiva las pestanas de cada perfil. Crea perfiles personalizados con la combinacion de modulos que necesites.
        </p>
      </div>

      {/* Role selector + new profile button */}
      <div className="flex flex-wrap items-center gap-2">
        {roles.map(role => (
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

        <button
          onClick={() => { setShowNewForm(true); setNewFormError(''); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
          style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px dashed #CBD5E1' }}
        >
          <Plus size={14} />
          Nuevo perfil
        </button>
      </div>

      {/* New profile form */}
      {showNewForm && (
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>Crear nuevo perfil</p>
            <button
              onClick={() => { setShowNewForm(false); setNewFormError(''); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
              style={{ color: '#94A3B8' }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre del perfil</label>
              <input
                type="text"
                value={newForm.label}
                onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleCreateProfile()}
                placeholder="Ej: Supervisor 2, Contabilidad..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#475569' }}>Color</label>
              <div className="flex gap-2 flex-wrap">
                {CUSTOM_PALETTE.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setNewForm(f => ({ ...f, colorIdx: i }))}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer"
                    style={{
                      backgroundColor: p.color,
                      outline: newForm.colorIdx === i ? `2px solid ${p.color}` : 'none',
                      outlineOffset: '2px',
                    }}
                  >
                    {newForm.colorIdx === i && <Check size={12} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
            {newFormError && (
              <p className="text-xs" style={{ color: '#DC2626' }}>{newFormError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreateProfile}
                disabled={creating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: CUSTOM_PALETTE[newForm.colorIdx].color, color: '#FFFFFF' }}
              >
                {creating ? 'Creando...' : 'Crear perfil'}
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewFormError(''); }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer hover:bg-slate-100"
                style={{ color: '#64748B' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions grid */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: currentRole?.bg }}
            >
              <Users size={15} style={{ color: currentRole?.color }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                Perfil: {currentRole?.label}
              </p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                {enabledCount} de {ALL_TABS.length} modulos activos
              </p>
            </div>
          </div>

          {!currentRole?.isBuiltIn && currentRole && (
            <button
              onClick={() => handleDeleteProfile(currentRole.id)}
              disabled={deletingRole === currentRole.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
              title="Eliminar perfil personalizado"
            >
              <Trash2 size={12} />
              {deletingRole === currentRole.id ? 'Eliminando...' : 'Eliminar perfil'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: currentRole?.color }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_TABS.map(tab => {
              const enabled = permissions[selectedRole]?.[tab.id] ?? false;
              const isSaving = saving === `${selectedRole}-${tab.id}`;
              const TabIcon = tab.icon;
              return (
                <div
                  key={tab.id}
                  className="flex items-center justify-between p-3 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: enabled ? currentRole?.bg : '#F8FAFC',
                    border: `1px solid ${enabled ? currentRole?.border : '#E2E8F0'}`,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TabIcon size={15} style={{ color: enabled ? currentRole?.color : '#94A3B8', flexShrink: 0 }} />
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
                      backgroundColor: enabled ? currentRole?.color : '#CBD5E1',
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
        Los cambios aplican la proxima vez que el usuario recargue su panel. Los perfiles personalizados necesitan ser asignados a usuarios desde Gestion de Usuarios.
      </p>
    </div>
  );
}
