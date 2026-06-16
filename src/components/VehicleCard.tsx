import { Car, Shield, FileText, Phone, Calendar } from 'lucide-react';

export default function VehicleCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0'
      }}
    >
      <div className="p-5">

        <div className="flex items-center gap-3 mb-4">

          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: '#ECFDF5'
            }}
          >
            <Car
              size={18}
              style={{ color: '#065F46' }}
            />
          </div>

          <div>
            <h3 className="font-semibold">
              Vehículo Asignado
            </h3>

            <p className="text-xs text-slate-500">
              Vehículo activo
            </p>
          </div>

        </div>

        <div
          className="rounded-xl p-3 mb-4"
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0'
          }}
        >
          <div className="font-semibold">
            Volkswagen Golf
          </div>

          <div className="text-sm text-slate-500">
            2656 JVS
          </div>
        </div>

        <div className="space-y-2 text-sm">

          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <Shield size={14} />
              Seguro
            </span>

            <span>Mapfre</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <FileText size={14} />
              Nº póliza
            </span>

            <span>123456789</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <Calendar size={14} />
              ITV
            </span>

            <span>11/11/2026</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <Phone size={14} />
              Asistencia
            </span>

            <span>900123456</span>
          </div>

        </div>

      </div>
    </div>
  );
}