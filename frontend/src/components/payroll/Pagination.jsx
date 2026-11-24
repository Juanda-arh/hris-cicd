import { ChevronLeft, ChevronRight } from '../Icons';

// Devuelve p.ej. [1, 2, 3, '…', 7]
function pageList(page, totalPages, siblings, fill) {
  const pages = new Set([1, totalPages]);
  for (let i = page - siblings; i <= page + siblings; i++) if (i > 0 && i <= totalPages) pages.add(i);
  if (page <= siblings + 1) for (let i = 1; i <= Math.min(totalPages, fill); i++) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, totalPages, onChange, shown, total }) {
  const renderPages = (siblings, fill, cls) => (
    <div className={`pagination__pages ${cls}`}>
      <button className="page-btn" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft />
      </button>
      {pageList(page, totalPages, siblings, fill).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="page-ellipsis">…</span>
        ) : (
          <button key={p} className={`page-btn ${p === page ? 'is-active' : ''}`} onClick={() => onChange(p)}>
            {p}
          </button>
        )
      )}
      <button className="page-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight />
      </button>
    </div>
  );

  return (
    <div className="pagination">
      <span className="muted">Showing {shown} of {total}</span>
      {renderPages(1, 3, 'desktop-only-flex')}
      {renderPages(0, 2, 'mobile-only-flex')}
    </div>
  );
}
