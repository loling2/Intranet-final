import { useMemo, useState, type ReactNode } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ListaItem } from '../lib/crmAsignaciones';

const PAGE_SIZE = 15;

interface Props {
  items: ListaItem[];
  placeholder: string;
  emptyText: string;
  renderRow: (item: ListaItem) => ReactNode;
}

export default function CrmListaPaginada({ items, placeholder, emptyText, renderRow }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.nombre} ${i.subtitulo ?? ''}`.toLowerCase().includes(q));
  }, [items, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filtrados.slice(paginaActual * PAGE_SIZE, (paginaActual + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(0); }}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }} />
      </div>
      <div className="rounded-xl divide-y" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {visibles.length === 0 && (
          <p className="text-sm px-4 py-6 text-center" style={{ color: '#64748B' }}>{emptyText}</p>
        )}
        {visibles.map((item) => (
          <div key={item.id}>{renderRow(item)}</div>
        ))}
      </div>
      {filtrados.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
            <ChevronLeft size={14} /> Anterior
          </button>
          <span className="text-xs" style={{ color: '#64748B' }}>
            Página {paginaActual + 1} de {totalPaginas} · {filtrados.length} resultados
          </span>
          <button onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas - 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
            Siguiente <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
