import { formatNumber } from '../utils/format';

/** Builds a compact list of page numbers with ellipses: 1 … 4 5 6 … 12 */
export function pageWindow(page, totalPages, radius = 1) {
  const pages = new Set([1, totalPages]);
  for (let p = page - radius; p <= page + radius; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
    result.push(p);
  });
  return result;
}

export default function Pagination({ page, perPage, total, onChange, className = '' }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (perPage || 1)));
  if (!total) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className={`d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2 ${className}`}>
      <div className="small text-muted">
        Showing <strong>{formatNumber(from)}</strong>–<strong>{formatNumber(to)}</strong> of{' '}
        <strong>{formatNumber(total)}</strong>
      </div>
      {totalPages > 1 && (
        <nav aria-label="Pagination">
          <ul className="pagination pagination-sm mb-0 fa-pagination">
            <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
              <button type="button" className="page-link" onClick={() => onChange(page - 1)} aria-label="Previous page">
                <i className="bi bi-chevron-left" aria-hidden="true" />
              </button>
            </li>
            {pageWindow(page, totalPages).map((p, i) =>
              p === '…' ? (
                <li key={`gap-${i}`} className="page-item disabled">
                  <span className="page-link">…</span>
                </li>
              ) : (
                <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => onChange(p)}
                    aria-current={p === page ? 'page' : undefined}
                  >
                    {p}
                  </button>
                </li>
              ),
            )}
            <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
              <button type="button" className="page-link" onClick={() => onChange(page + 1)} aria-label="Next page">
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
