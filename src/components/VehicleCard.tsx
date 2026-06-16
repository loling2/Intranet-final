import { Car, Shield, FileText, Phone, Calendar } from 'lucide-react';

interface VehicleData {
  matricula?: string;
  marca?: string;
  modelo?: string;
  fecha_itv?: string;
  aseguradora?: string;
  numero_poliza?: string;
  telefono_asistencia?: string;
}

export default function VehicleCard({
  vehicle,
}: {
  vehicle: VehicleData | null;
}) {
  const hasVehicle = !!vehicle;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
      }}
    >
      <div className="p-5">

        <div className="flex items-center gap-3 mb-4">

          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: '#ECFDF5',
            }}
          >
            <Car
              size={18}
              style={{ color: '#065F46' }}
            />
          </div>

          <div>
            <h3 className="font-semibold">
              Vehículo Fichado
            </h3>

            <p className="text-xs text-slate-500">
              {hasVehicle ? 'Vehículo activo' : 'Sin vehículo'}
            </p>
          </div>

        </div>

        {hasVehicle ? (
          <>
            <div
              className="rounded-xl p-3 mb-4"
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div className="font-semibold">
                {vehicle.marca} {vehicle.modelo}
              </div>

              <div className="text-sm text-slate-500">
                {vehicle.matricula}
              </div>
            </div>

            <div className="space-y-2 text-sm">

              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <Shield size={14} />
                  Seguro
                </span>

                <span>{vehicle.aseguradora || '-'}</span>
              </div>

              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <FileText size={14} />
                  Nº póliza
                </span>

                <span>{vehicle.numero_poliza || '-'}</span>
              </div>

              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <Calendar size={14} />
                  ITV
                </span>

                <span>{vehicle.fecha_itv || '-'}</span>
              </div>

              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <Phone size={14} />
                  Asistencia
                </span>

                <span>{vehicle.telefono_asistencia || '-'}</span>
              </div>

            </div>
          </>
        ) : (
          <div
            className="text-sm text-slate-500"
            style={{
              paddingTop: '10px',
            }}
          >
            No hay ningún vehículo fichado actualmente.
          </div>
        )}

      </div>
    </div>
  );
}