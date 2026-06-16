import { Car } from 'lucide-react';

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
              Sin vehículo
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}