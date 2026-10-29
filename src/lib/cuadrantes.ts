export interface FichajeEvento {
  empleado_id: string;
  fecha: string;
  timestamp: string;
  tipo_evento: string;
}

export type TipoTurno = 'manana' | 'tarde' | 'noche';

export interface TurnoRealizado {
  fecha: string;
  inicio: string;
  fin: string | null;
  tipo: TipoTurno;
}

export interface TurnoPlanificado {
  empleado_id: string;
  fecha: string;
  inicio: string;
  fin: string;
}

export type VistaCuadrante = 'semana' | 'mes' | 'anio';

export const ETIQUETA_TURNO: Record<TipoTurno, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
};

export const TURNOS_PREDEFINIDOS: { tipo: TipoTurno; inicio: string; fin: string }[] = [
  { tipo: 'manana', inicio: '07:00', fin: '15:00' },
  { tipo: 'tarde', inicio: '15:00', fin: '22:00' },
  { tipo: 'noche', inicio: '22:00', fin: '07:00' },
];

const MINUTOS_INICIO_MANANA = 7 * 60;
const MINUTOS_FIN_MANANA = 15 * 60;
const MINUTOS_FIN_TARDE = 22 * 60;

const horaMinutoFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const horaFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatHora(iso: string): string {
  return horaFormatter.format(new Date(iso));
}

export function aHoraCorta(hora: string): string {
  return hora.slice(0, 5);
}

export function minutosDelDiaMadrid(iso: string): number {
  const partes = horaMinutoFormatter.formatToParts(new Date(iso));
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  return hora * 60 + minuto;
}

export function clasificarTurno(inicioIso: string): TipoTurno {
  const minutos = minutosDelDiaMadrid(inicioIso);
  if (minutos >= MINUTOS_INICIO_MANANA && minutos <= MINUTOS_FIN_MANANA) return 'manana';
  if (minutos > MINUTOS_FIN_MANANA && minutos <= MINUTOS_FIN_TARDE) return 'tarde';
  return 'noche';
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

export function getMonthDays(ancla: Date): Date[] {
  const y = ancla.getFullYear();
  const m = ancla.getMonth();
  const total = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: total }, (_, i) => new Date(y, m, i + 1));
}

export function etiquetaDiaSemana(date: Date): string {
  return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][date.getDay()];
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
      if (previa) turnosDe(evento.empleado_id).push({ ...previa, fin: null, tipo: clasificarTurno(previa.inicio) });
      entradasAbiertas.set(evento.empleado_id, { fecha: evento.fecha, inicio: evento.timestamp });
    } else if (evento.tipo_evento === 'salida') {
      const abierta = entradasAbiertas.get(evento.empleado_id);
      if (!abierta) continue;
      turnosDe(evento.empleado_id).push({ ...abierta, fin: evento.timestamp, tipo: clasificarTurno(abierta.inicio) });
      entradasAbiertas.delete(evento.empleado_id);
    }
  }

  entradasAbiertas.forEach((abierta, empleadoId) => {
    turnosDe(empleadoId).push({ ...abierta, fin: null, tipo: clasificarTurno(abierta.inicio) });
  });

  return turnosPorEmpleado;
}
