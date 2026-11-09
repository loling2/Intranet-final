import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import CrmListaPaginada from './CrmListaPaginada';
import { actualizarAsignados, type AsignacionesData, type ListaItem } from '../lib/crmAsignaciones';

interface Unidad {
  singular: string;
  plural: string;
}

interface Props {
  titulo: string;
  descripcion: string;
  tituloIzquierda: string;
  tituloDerecha: string;
  textoVacioIzquierda: string;
  unidad: Unidad;
  cargar: () => Promise<AsignacionesData>;
  alternar: (izquierdaId: string, derechaId: string, activo: boolean) => Promise<boolean>;
}

export default function CrmAsignacionPanel({
  titulo, descripcion, tituloIzquierda, tituloDerecha, textoVacioIzquierda, unidad, cargar, alternar,
}: Props) {
  const [datos, setDatos] = useState<AsignacionesData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    cargar()
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setError('No se pudieron cargar los datos.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [cargar]);

  const seleccionado: ListaItem | null = datos?.izquierda.find((i) => i.id === seleccionadoId) ?? null;
  const asignadosSeleccionado = seleccionado ? datos?.asignados[seleccionado.id] ?? new Set<string>() : new Set<string>();

  const toggle = async (derechaId: string) => {
    if (!seleccionado) return;
    const izquierdaId = seleccionado.id;
    const activo = asignadosSeleccionado.has(derechaId);
    setGuardandoId(derechaId);
    setError('');
    const ok = await alternar(izquierdaId, derechaId, activo);
    if (ok) {
      setDatos((prev) => prev && { ...prev, asignados: actualizarAsignados(prev.asignados, izquierdaId, derechaId, !activo) });
    } else {
      setError('No se pudo guardar el cambio. Inténtalo de nuevo.');
    }
    setGuardandoId(null);
  };

  const etiquetaUnidad = (n: number) => `${n} ${n === 1 ? unidad.singular : unidad.plural}`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>{titulo}</h2>
        <p className="text-sm" style={{ color: '#64748B' }}>{descripcion}</p>
      </div>

      {cargando && (
        <div className="text-center py-12">
          <Loader2 size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>Cargando...</p>
        </div>
      )}

      {!cargando && error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}

      {datos && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>{tituloIzquierda}</h4>
            <CrmListaPaginada
              items={datos.izquierda}
              placeholder={`Buscar ${tituloIzquierda.toLowerCase()}...`}
              emptyText={textoVacioIzquierda}
              renderRow={(item) => {
                const sel = item.id === seleccionadoId;
                const n = datos.asignados[item.id]?.size ?? 0;
                return (
                  <button onClick={() => setSeleccionadoId(item.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
                    style={{ backgroundColor: sel ? '#E0F2FE' : '#FFFFFF' }}>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate" style={{ color: '#0F172A' }}>{item.nombre}</span>
                      {item.subtitulo && (
                        <span className="block text-xs truncate" style={{ color: '#64748B' }}>{item.subtitulo}</span>
                      )}
                    </span>
                    <span className="text-xs font-medium whitespace-nowrap" style={{ color: n > 0 ? '#0369A1' : '#94A3B8' }}>
                      {etiquetaUnidad(n)}
                    </span>
                  </button>
                );
              }}
            />
          </div>

          <div className="space-y-3">
            {!seleccionado && (
              <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <p className="text-sm" style={{ color: '#64748B' }}>Selecciona un elemento de la lista para ver sus asignaciones</p>
              </div>
            )}
            {seleccionado && (
              <>
                <div>
                  <h4 className="text-sm font-bold" style={{ color: '#0F172A' }}>{seleccionado.nombre}</h4>
                  <p className="text-xs" style={{ color: '#64748B' }}>{tituloDerecha}: activa los que correspondan</p>
                </div>
                <CrmListaPaginada
                  key={seleccionado.id}
                  items={datos.derecha}
                  placeholder={`Buscar ${tituloDerecha.toLowerCase()}...`}
                  emptyText="No hay elementos que mostrar"
                  renderRow={(item) => {
                    const activo = asignadosSeleccionado.has(item.id);
                    const guardando = guardandoId === item.id;
                    return (
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate" style={{ color: '#0F172A' }}>{item.nombre}</span>
                          {item.subtitulo && (
                            <span className="block text-xs truncate" style={{ color: '#64748B' }}>{item.subtitulo}</span>
                          )}
                        </span>
                        <button role="switch" aria-checked={activo} onClick={() => toggle(item.id)} disabled={guardando}
                          className="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-60 flex-shrink-0"
                          style={{ backgroundColor: activo ? '#0369A1' : '#CBD5E1' }}>
                          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                            style={{ transform: activo ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                      </div>
                    );
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
