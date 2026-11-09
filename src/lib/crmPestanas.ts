import { supabase } from '../supabaseClient';

export interface CrmPestanaDef {
  key: string;
  label: string;
}

export const CRM_PANEL_PESTANAS: CrmPestanaDef[] = [
  { key: 'residentes', label: 'Residentes' },
  { key: 'incidencias', label: 'Incidencias' },
  { key: 'actividades', label: 'Actividades' },
  { key: 'actas', label: 'Actas' },
  { key: 'tratamientos', label: 'Tratamientos' },
  { key: 'estadisticas', label: 'Estadísticas' },
  { key: 'ayuda', label: 'Ayuda' },
  { key: 'permisos', label: 'Permisos' },
];

export const CRM_FICHA_PESTANAS: CrmPestanaDef[] = [
  { key: 'info', label: 'Información' },
  { key: 'contactos', label: 'Contactos' },
  { key: 'cuentas', label: 'Prestaciones' },
  { key: 'medico', label: 'Información médica' },
  { key: 'tratamiento', label: 'Tratamiento' },
  { key: 'seguimiento', label: 'Seguimiento diario' },
  { key: 'llamadas', label: 'Llamadas y visitas' },
  { key: 'medicacion', label: 'Medicación' },
  { key: 'abvd', label: 'ABVD' },
  { key: 'inc_sanitarias', label: 'Inc. sanitarias' },
  { key: 'pautas', label: 'Pautas' },
  { key: 'pai', label: 'PAI / PIE' },
  { key: 'sesiones', label: 'Sesiones' },
  { key: 'calendario', label: 'Calendario y Notas' },
  { key: 'documentos', label: 'Documentos' },
];

export const CRM_TODAS_PESTANAS = [...CRM_PANEL_PESTANAS, ...CRM_FICHA_PESTANAS].map((p) => p.key);

/** Pestañas CRM visibles para el usuario. Admin y RRHH ven todas; sin perfil de puesto no hay restricción. */
export async function fetchCrmPestanasPermitidas(userId: string): Promise<string[]> {
  const { data: profile } = await supabase
    .from('user_profiles').select('role, roles').eq('id', userId).maybeSingle();
  const roles = [profile?.role ?? '', ...((profile?.roles as string[] | null) ?? [])];
  if (roles.includes('admin') || roles.includes('rrhh')) return CRM_TODAS_PESTANAS;

  const { data: empleado } = await supabase
    .from('empleados').select('puesto_tag_id').eq('user_id', userId).maybeSingle();
  if (!empleado?.puesto_tag_id) return CRM_TODAS_PESTANAS;

  const { data: perfil } = await supabase
    .from('crm_perfiles')
    .select('crm_perfil_pestanas(pestana, activo)')
    .eq('puesto_tag_id', empleado.puesto_tag_id)
    .maybeSingle();
  if (!perfil) return CRM_TODAS_PESTANAS;

  const filas = (perfil as unknown as { crm_perfil_pestanas: { pestana: string; activo: boolean }[] }).crm_perfil_pestanas ?? [];
  return filas.filter((f) => f.activo).map((f) => f.pestana);
}
