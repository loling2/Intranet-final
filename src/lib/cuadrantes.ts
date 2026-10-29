export interface FichajeEvento {
  empleado_id: string;
  fecha: string;
  timestamp: string;
  tipo_evento: string;
}

export interface TurnoRealizado {
  fecha: string;
  inicio: string;
  fin: string | null;
}

const horaFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatHora(iso: string): string {
  return horaFormatter.format(new Date(iso));
}

export function toFechaISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });
}

export function construirTurnos(eventos: FichajeEvento[]): Map<string, TurnoRealizado[]> {
  const turnosPorEmpleado = new Map<string, TurnoRealizado[]>();
  const entradasAbiertas = new Map<string, { fecha: string; inicio: string }>();

  const turnosDe = (empleadoId: string) => {
    let lista = turnosPorEmpleado.get(empleadoId);
    if (!lista) {
      lista = [];
      turnosPorEmpleado.set(empleadoId, lista);
    }
    return lista;
  };

  for (const evento of eventos) {
    if (evento.tipo_evento === 'entrada') {
      const previa = entradasAbiertas.get(evento.empleado_id);
      if (previa) turnosDe(evento.empleado_id).push({ ...previa, fin: null });
      entradasAbiertas.set(evento.empleado_id, { fecha: evento.fecha, inicio: evento.timestamp });
    } else if (evento.tipo_evento === 'salida') {
      const abierta = entradasAbiertas.get(evento.empleado_id);
      if (!abierta) continue;
      turnosDe(evento.empleado_id).push({ ...abierta, fin: evento.timestamp });
      entradasAbiertas.delete(evento.empleado_id);
    }
  }

  entradasAbiertas.forEach((abierta, empleadoId) => {
    turnosDe(empleadoId).push({ ...abierta, fin: null });
  });

  return turnosPorEmpleado;
}
