import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback';
import { getCategories } from '../api/categories';
import { getApiError } from '../api/client';
import { formatNumber, formatPercent, plural } from '../utils/format';
import { categoryColor, categoryIcon } from '../utils/labels';

export default function CategoriesPage() {
  const [state, setState] = useState({ loading: true, error: null, data: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await getCategories();
      setState({ loading: false, error: null, data });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: getApiError(err) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = [...state.data].sort((a, b) => (b.count || 0) - (a.count || 0));
  const total = sorted.reduce((sum, c) => sum + (c.count || 0), 0);

  return (
    <div className="fa-page">
      <div className="mb-4">
        <h2 className="h5 fw-bold mb-1">Categories</h2>
        <p className="text-muted small mb-0">
          The AI sorts every document into a category. {sorted.length > 0 && `${plural(sorted.length, 'category', 'categories')} · ${plural(total, 'document')}.`}
        </p>
      </div>

      {state.loading && !state.data.length && (
        <div className="row g-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="col-sm-6 col-lg-4 col-xxl-3">
              <div className="card fa-card">
                <div className="card-body">
                  <Skeleton width={44} height={44} rounded={12} className="mb-3" />
                  <Skeleton width="60%" height={14} className="mb-2" />
                  <Skeleton width="40%" height={10} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!state.loading && state.error && (
        <div className="card fa-card">
          <ErrorState title="Couldn't load categories" message={state.error.message} onRetry={load} />
        </div>
      )}

      {!state.loading && !state.error && !sorted.length && (
        <div className="card fa-card">
          <EmptyState
            icon="bi-tags"
            title="No categories yet"
            action={
              <Link to="/upload" className="btn btn-primary btn-sm">
                Upload a document
              </Link>
            }
          >
            Categories such as University, Finance or Career appear after the AI classifies your documents.
          </EmptyState>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="row g-3">
          {sorted.map((row) => {
            const name = row.category || 'Uncategorised';
            const color = categoryColor(name);
            const share = total ? (row.count || 0) / total : 0;
            const body = (
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between mb-3">
                  <span className="fa-icon-tile" style={{ color, backgroundColor: `${color}1a` }} aria-hidden="true">
                    <i className={`bi ${categoryIcon(name)}`} />
                  </span>
                  <span className="small text-muted">{formatPercent(share)}</span>
                </div>
                <div className="fw-semibold text-body text-truncate">{name}</div>
                <div className="small text-muted mb-3">{plural(row.count || 0, 'document')}</div>
                <div className="progress" style={{ height: 6 }} aria-hidden="true">
                  <div className="progress-bar" style={{ width: `${Math.max(share * 100, 2)}%`, backgroundColor: color }} />
                </div>
              </div>
            );
            return (
              <div key={name} className="col-sm-6 col-lg-4 col-xxl-3">
                {row.category ? (
                  <Link
                    to={`/documents?category=${encodeURIComponent(row.category)}`}
                    className="card fa-card fa-category-card h-100 text-decoration-none"
                    aria-label={`${name}: ${formatNumber(row.count)} documents`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="card fa-card h-100">{body}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
