import { supabase } from '../supabaseClient';

export interface AutorActual {
  userId: string | null;
  nombre: string;
}

export async function obtenerAutorActual(): Promise<AutorActual> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  let nombre = auth.user?.email ?? '';
  if (userId) {
    const { data: empleado } = await supabase
      .from('empleados')
      .select('nombre, apellidos')
      .eq('user_id', userId)
      .maybeSingle();
    if (empleado) nombre = `${empleado.nombre} ${empleado.apellidos ?? ''}`.trim();
  }
  return { userId, nombre };
}
