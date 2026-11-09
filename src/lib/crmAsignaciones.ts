import { supabase } from '../supabaseClient';

export interface ListaItem {
  id: string;
  nombre: string;
  subtitulo?: string;
}

export interface AsignacionesData {
  izquierda: ListaItem[];
  derecha: ListaItem[];
  asignados: Record<string, Set<string>>;
}

type Fila = Record<string, string>;

function agrupar(filas: Fila[], clave: string, valor: string): Record<string, Set<string>> {
  const mapa: Record<string, Set<string>> = {};
  for (const f of filas) (mapa[f[clave]] ??= new Set()).add(f[valor]);
  return mapa;
}

export function actualizarAsignados(
  mapa: Record<string, Set<string>>,
  izquierdaId: string,
  derechaId: string,
  activo: boolean,
): Record<string, Set<string>> {
  const nuevo = new Set(mapa[izquierdaId] ?? []);
  if (activo) nuevo.add(derechaId); else nuevo.delete(derechaId);
  return { ...mapa, [izquierdaId]: nuevo };
}

async function fetchEmpleadosActivos(): Promise<ListaItem[]> {
  const [empRes, puestosRes] = await Promise.all([
    supabase.from('empleados').select('user_id, nombre, apellidos, puesto_tag_id')
      .eq('activo', true).not('user_id', 'is', null).order('nombre'),
    supabase.from('puesto_tags').select('id, nombre'),
  ]);
  if (empRes.error) throw empRes.error;
  if (puestosRes.error) throw puestosRes.error;
  const puestos = new Map(((puestosRes.data ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const porUsuario = new Map<string, ListaItem>();
  for (const e of (empRes.data ?? []) as { user_id: string; nombre: string; apellidos: string | null; puesto_tag_id: string | null }[]) {
    if (porUsuario.has(e.user_id)) continue;
    porUsuario.set(e.user_id, {
      id: e.user_id,
      nombre: `${e.nombre} ${e.apellidos ?? ''}`.trim(),
      subtitulo: (e.puesto_tag_id && puestos.get(e.puesto_tag_id)) || 'Sin puesto',
    });
  }
  return [...porUsuario.values()];
}

async function fetchPerfilesPorRol(rol: 'supervisor' | 'coordinador'): Promise<ListaItem[]> {
  const { data, error } = await supabase.from('user_profiles').select('id, nombre, email')
    .eq('activo', true).or(`role.eq.${rol},roles.cs.{${rol}}`).order('nombre');
  if (error) throw error;
  return ((data ?? []) as { id: string; nombre: string; email: string | null }[]).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    subtitulo: p.email ?? undefined,
  }));
}

export async function cargarCentrosPorTrabajador(): Promise<AsignacionesData> {
  const [empleados, centrosRes, asigRes] = await Promise.all([
    fetchEmpleadosActivos(),
    supabase.from('centros').select('id, nombre').order('nombre'),
    supabase.from('crm_usuario_centros').select('user_id, centro_id'),
  ]);
  if (centrosRes.error) throw centrosRes.error;
  if (asigRes.error) throw asigRes.error;
  return {
    izquierda: empleados,
    derecha: ((centrosRes.data ?? []) as { id: string; nombre: string }[]).map((c) => ({ id: c.id, nombre: c.nombre })),
    asignados: agrupar((asigRes.data ?? []) as Fila[], 'user_id', 'centro_id'),
  };
}

export async function alternarCentroTrabajador(userId: string, centroId: string, activo: boolean): Promise<boolean> {
  const { error } = activo
    ? await supabase.from('crm_usuario_centros').delete().eq('user_id', userId).eq('centro_id', centroId)
    : await supabase.from('crm_usuario_centros').insert({ user_id: userId, centro_id: centroId });
  return !error;
}

export async function cargarEmpleadosPorCoordinador(): Promise<AsignacionesData> {
  const [coordinadores, empleados, asigRes] = await Promise.all([
    fetchPerfilesPorRol('coordinador'),
    fetchEmpleadosActivos(),
    supabase.from('crm_coordinador_empleados').select('coordinador_id, empleado_id'),
  ]);
  if (asigRes.error) throw asigRes.error;
  return {
    izquierda: coordinadores,
    derecha: empleados,
    asignados: agrupar((asigRes.data ?? []) as Fila[], 'coordinador_id', 'empleado_id'),
  };
}

export async function alternarEmpleadoCoordinador(coordinadorId: string, empleadoId: string, activo: boolean): Promise<boolean> {
  const { error } = activo
    ? await supabase.from('crm_coordinador_empleados').delete().eq('coordinador_id', coordinadorId).eq('empleado_id', empleadoId)
    : await supabase.from('crm_coordinador_empleados').insert({ coordinador_id: coordinadorId, empleado_id: empleadoId });
  return !error;
}

export async function cargarCoordinadoresPorSupervisor(): Promise<AsignacionesData> {
  const [supervisores, coordinadores, asigRes] = await Promise.all([
    fetchPerfilesPorRol('supervisor'),
    fetchPerfilesPorRol('coordinador'),
    supabase.from('coordinador_supervisores').select('supervisor_id, coordinador_id'),
  ]);
  if (asigRes.error) throw asigRes.error;
  return {
    izquierda: supervisores,
    derecha: coordinadores,
    asignados: agrupar((asigRes.data ?? []) as Fila[], 'supervisor_id', 'coordinador_id'),
  };
}

export async function alternarCoordinadorSupervisor(supervisorId: string, coordinadorId: string, activo: boolean): Promise<boolean> {
  const { error } = activo
    ? await supabase.from('coordinador_supervisores').delete().eq('supervisor_id', supervisorId).eq('coordinador_id', coordinadorId)
    : await supabase.from('coordinador_supervisores').insert({ supervisor_id: supervisorId, coordinador_id: coordinadorId });
  return !error;
}
