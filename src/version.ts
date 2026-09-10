export const APP_VERSION = 'v1.0.2';

export const VERSION_HISTORY: { version: string; date: string; changes: string[] }[] = [
  {
    version: 'v1.0.0',
    date: '2026-09-10',
    changes: [
      'Sistema de fichajes con alternancia automática entrada/salida',
      'Informe agrupado por ID de empleado (no por nombre)',
      'Confirmación correcta del tipo de fichaje registrado',
      'GPS con timeout de 15 segundos',
    ],
  },
  {
    version: 'v1.0.1',
    date: '2026-09-10',
    changes: [
      'Versión visible en pantalla de acceso, kiosco y registro de jornada',
      'Historial de versiones accesible para verificar si el trabajador tiene la última',
    ],
  },
  {
    version: 'v1.0.2',
    date: '2026-09-10',
    changes: [
      'Cálculo correcto de turnos nocturnos consecutivos',
      'Horas totales mostradas en el día de la salida del turno',
    ],
  },
];

export function isLatestVersion(stored: string | null): boolean {
  if (!stored) return false;
  return stored === APP_VERSION;
}

export function getStoredVersion(): string | null {
  try { return localStorage.getItem('app_version'); } catch { return null; }
}

export function getPreviousVersion(): string | null {
  try { return localStorage.getItem('previous_app_version'); } catch { return null; }
}
