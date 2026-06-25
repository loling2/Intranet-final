import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, totalPages, totalItems, pageSize, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#E2E8F0' }}>
      <p className="text-xs" style={{ color: '#94A3B8' }}>
        {from}–{to} de {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors hover:bg-slate-100"
          style={{ color: '#475569' }}
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs" style={{ color: '#94A3B8' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer transition-colors"
              style={{
                backgroundColor: p === page ? '#065F46' : 'transparent',
                color: p === page ? '#FFFFFF' : '#475569',
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors hover:bg-slate-100"
          style={{ color: '#475569' }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/** Hook-style helper: returns the slice of items for the current page */
export function paginate<T>(items: T[], page: number, pageSize = 25): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export function totalPages(count: number, pageSize = 25) {
  return Math.max(1, Math.ceil(count / pageSize));
}
