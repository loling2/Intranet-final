import { useMemo } from 'react';
import type { TurnoRealizado } from '../lib/cuadrantes';

interface EmpleadoAnual {
  id: string;
  nombre: string;
  apellidos: string | null;
  puesto: string | null;
}

interface Props {
  anio: number;
  empleados: EmpleadoAnual[];
  turnos: Map<string, TurnoRealizado[]>;
  onSeleccionarMes: (mes: number) => void;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function CuadrantesAnioView({ anio, empleados, turnos, onSeleccionarMes }: Props) {
  const diasPorEmpleado = useMemo(() => {
    const resultado = new Map<string, number[]>();
    empleados.forEach((emp) => {
      const porMes = Array.from({ length: 12 }, () => new Set<string>());
      (turnos.get(emp.id) ?? []).forEach((t) => {
        const mes = Number(t.fecha.slice(5, 7)) - 1;
        if (mes >= 0 && mes < 12) porMes[mes].add(t.fecha);
      });
      resultado.set(emp.id, porMes.map((s) => s.size));
    });
    return resultado;
  }, [empleados, turnos]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr style={{ backgroundColor: '#F8FAFC' }}>
            <th className="sticky left-0 z-10 border-b px-3 py-2 text-left text-xs font-semibold uppercase" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#475569' }}>
              Empleado
            </th>
            {MESES.map((mes, i) => (
              <th key={mes} className="border-b px-2 py-2 text-center text-xs font-semibold" style={{ borderColor: '#E2E8F0', color: '#475569' }}>
                <button type="button" onClick={() => onSeleccionarMes(i)} className="rounded px-2 py-1 transition-colors hover:bg-slate-200">
                  {mes} {anio}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empleados.map((emp) => {
            const dias = diasPorEmpleado.get(emp.id) ?? [];
            return (
              <tr key={emp.id} className="transition-colors hover:bg-slate-50">
                <td className="sticky left-0 z-10 border-b px-3 py-2" style={{ borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' }}>
                  <p className="font-medium" style={{ color: '#0F172A' }}>{[emp.apellidos, emp.nombre].filter(Boolean).join(', ')}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{emp.puesto || 'Sin puesto'}</p>
                </td>
                {dias.map((total, mes) => (
                  <td key={mes} className="border-b px-2 py-2 text-center" style={{ borderColor: '#F1F5F9' }}>
                    {total === 0 ? (
                      <span className="text-xs" style={{ color: '#CBD5E1' }}>-</span>
                    ) : (
                      <button type="button" onClick={() => onSeleccionarMes(mes)}
                        className="rounded-md px-2 py-1 font-mono text-xs font-medium transition-colors hover:bg-blue-100"
                        style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                        {total} d
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
