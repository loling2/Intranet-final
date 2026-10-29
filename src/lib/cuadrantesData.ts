import { supabase } from '../supabaseClient';
import { toFechaISO, type FichajeEvento, type TurnoPlanificado } from './cuadrantes';

export interface EmpleadoCuadrante {
  id: string;
  nombre: string;
  apellidos: string | null;
  puesto: string | null;
}

export interface DatosCuadrante {
  empleados: EmpleadoCuadrante[];
  eventos: FichajeEvento[];
  planificados: TurnoPlanificado[];
}

const TAMANO_PAGINA = 1000;

async function fichajesDelCentro(centroId: string, desde: string, hasta: string): Promise<FichajeEvento[]> {
  const todos: FichajeEvento[] = [];
  for (let inicio = 0; ; inicio += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from('fichajes')
      .select('empleado_id, fecha, timestamp, tipo_evento')
      .eq('centro_id', centroId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .in('tipo_evento', ['entrada', 'salida'])
      .order('timestamp', { ascending: true })
      .range(inicio, inicio + TAMANO_PAGINA - 1);
    if (error) throw error;
    const pagina = (data as FichajeEvento[]) ?? [];
    todos.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) break;
  }
  return todos;
}

export async function cargarDatosCuadrante(centroId: string, desde: string, hasta: string): Promise<DatosCuadrante> {
  const siguienteDia = new Date(`${hasta}T12:00:00`);
  siguienteDia.setDate(siguienteDia.getDate() + 1);

  const [eventos, asignados, planificados] = await Promise.all([
    fichajesDelCentro(centroId, desde, toFechaISO(siguienteDia)),
    supabase
      .from('empleados')
      .select('id, nombre, apellidos, puesto')
      .eq('centro_id', centroId)
      .eq('activo', true),
    supabase
      .from('turnos_asignados')
      .select('empleado_id, fecha, inicio, fin')
      .eq('centro_id', centroId)
      .gte('fecha', desde)
      .lte('fecha', hasta),
  ]);

  if (asignados.error) throw asignados.error;
  if (planificados.error) throw planificados.error;

  const idsFichados = [...new Set(eventos.map((e) => e.empleado_id))];
  let fichados: EmpleadoCuadrante[] = [];
  if (idsFichados.length > 0) {
    const { data, error } = await supabase
      .from('empleados')
      .select('id, nombre, apellidos, puesto')
      .in('id', idsFichados);
    if (error) throw error;
    fichados = (data as EmpleadoCuadrante[]) ?? [];
  }

  const porId = new Map<string, EmpleadoCuadrante>();
  [...((asignados.data as EmpleadoCuadrante[]) ?? []), ...fichados].forEach((e) => porId.set(e.id, e));

  return {
    empleados: [...porId.values()],
    eventos,
    planificados: (planificados.data as TurnoPlanificado[]) ?? [],
  };
}

export async function guardarTurnoPlanificado(
  turno: { empleado_id: string; centro_id: string; fecha: string; inicio: string; fin: string }
): Promise<void> {
  const { error } = await supabase
    .from('turnos_asignados')
    .upsert({ ...turno, updated_at: new Date().toISOString() }, { onConflict: 'empleado_id,fecha' });
  if (error) throw error;
}

export async function eliminarTurnoPlanificado(empleadoId: string, fecha: string): Promise<void> {
  const { error } = await supabase
    .from('turnos_asignados')
    .delete()
    .eq('empleado_id', empleadoId)
    .eq('fecha', fecha);
  if (error) throw error;
}
