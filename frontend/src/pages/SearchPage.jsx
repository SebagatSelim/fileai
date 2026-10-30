import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CategoryBadge, FileIcon } from '../components/Badges';
import { EmptyState, ErrorState, Skeleton } from '../components/Feedback';
import { searchDocuments } from '../api/search';
import { getApiError } from '../api/client';
import { formatDate, formatNumber, toPercentInt } from '../utils/format';
import { displayPath } from '../utils/folders';

const EXAMPLES = [
  'Find my Semester 1 Database assignment',
  'Invoices from this year',
  'Documents about network security',
  'My latest resume',
  'Meeting notes about the product roadmap',
];

const RESULT_LIMIT = 20;

function relevanceTone(pct) {
  if (pct >= 75) return 'high';
  if (pct >= 50) return 'medium';
  return 'low';
}

function ResultCard({ result }) {
  const pct = toPercentInt(result.relevance);
  return (
    <Link to={`/documents/${result.file_id}`} className="card fa-card fa-result-card text-decoration-none">
      <div className="card-body d-flex gap-3">
        <FileIcon type={result.file_type} name={result.name} size={48} />
        <div className="flex-grow-1 min-w-0">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div className="min-w-0">
              <h3 className="h6 fw-semibold text-body mb-0 text-truncate">{result.title || result.name}</h3>
              <div className="small text-muted text-truncate">{result.name}</div>
            </div>
            <div className={`fa-relevance fa-relevance-${relevanceTone(pct)}`} title="Relevance to your search">
              <div className="d-flex justify-content-between small fw-semibold mb-1">
                <span>{pct}%</span>
                <span className="text-muted fw-normal">match</span>
              </div>
              <div className="progress" style={{ height: 5 }} aria-hidden="true">
                <div className="progress-bar" style={{ width: `${pct}%` }} />
              </div>
              <span className="visually-hidden">{pct}% relevance</span>
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 my-2">
            <CategoryBadge category={result.category} />
            <span className="small text-muted text-truncate">
              <i className="bi bi-folder2 me-1" aria-hidden="true" />
              {displayPath(result.folder_path)}
            </span>
          </div>
          {result.summary && <p className="fa-clamp-2 small text-body-secondary mb-2">{result.summary}</p>}
          <div className="small text-muted">
            <i className="bi bi-calendar3 me-1" aria-hidden="true" />
            Uploaded {formatDate(result.uploaded_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const [input, setInput] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  const [runId, setRunId] = useState(0);
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const inputRef = useRef(null);

  // Keep the box in sync when the query changes from outside (top-bar quick search, back button).
  if (q !== lastQ) {
    setLastQ(q);
    setInput(q);
    setCategoryFilter('ALL');
  }

  useEffect(() => {
    if (!q) {
      setState({ loading: false, error: null, data: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    searchDocuments(q, { limit: RESULT_LIMIT, signal: controller.signal })
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) => {
        const error = getApiError(err);
        if (error.code !== 'CANCELLED') setState({ loading: false, error, data: null });
      });
    return () => controller.abort();
  }, [q, runId]);

  const submit = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    if (text === q) setRunId((n) => n + 1);
    else setParams({ q: text });
  };

  const runExample = (text) => {
    setInput(text);
    setParams({ q: text });
  };

  const results = useMemo(() => state.data?.results || [], [state.data]);
  const categories = useMemo(
    () => [...new Set(results.map((r) => r.category).filter(Boolean))].sort(),
    [results],
  );
  const visible = categoryFilter === 'ALL' ? results : results.filter((r) => r.category === categoryFilter);

  return (
    <div className="fa-page">
      <section className="fa-search-hero text-center mb-4">
        <div className="fa-search-icon mx-auto mb-3" aria-hidden="true">
          <i className="bi bi-search" />
        </div>
        <h2 className="h3 fw-bold mb-1">Semantic Document Search</h2>
        <p className="text-muted mb-4">
          Describe what you need — FileAI understands context, not just keywords.
        </p>
        <form className="fa-search-box mx-auto" role="search" onSubmit={submit}>
          <i className="bi bi-search text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "Find my Semester 1 Database assignment"'
            aria-label="Search your documents in plain English"
            autoFocus={!q}
            maxLength={500}
          />
          <button type="submit" className="btn btn-primary fa-btn-gradient" disabled={state.loading}>
            {state.loading ? (
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            ) : (
              <i className="bi bi-stars" aria-hidden="true" />
            )}
            <span className="ms-1">Search</span>
          </button>
        </form>
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mt-3">
          <span className="small text-muted">Try:</span>
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="fa-example-chip" onClick={() => runExample(example)}>
              {example}
            </button>
          ))}
        </div>
      </section>

      {!q && (
        <div className="card fa-card">
          <EmptyState icon="bi-chat-square-text" title="Ask in plain English">
            Search by meaning — mention a subject, a document type, a semester or a company and FileAI will rank your
            documents by how well they match.
          </EmptyState>
        </div>
      )}

      {q && state.loading && (
        <div className="d-grid gap-3" aria-busy="true" aria-label="Searching">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card fa-card">
              <div className="card-body d-flex gap-3">
                <Skeleton width={48} height={48} rounded={12} />
                <div className="flex-grow-1">
                  <Skeleton width="50%" height={14} className="mb-2" />
                  <Skeleton width="30%" height={10} className="mb-3" />
                  <Skeleton width="90%" height={10} className="mb-2" />
                  <Skeleton width="70%" height={10} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {q && !state.loading && state.error && (
        <div className="card fa-card">
          <ErrorState title="Search failed" message={state.error.message} onRetry={() => setRunId((n) => n + 1)} />
        </div>
      )}

      {q && !state.loading && !state.error && state.data && (
        <>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
            <div className="small text-muted" aria-live="polite">
              <strong className="text-body">{formatNumber(results.length)}</strong>{' '}
              {results.length === 1 ? 'result' : 'results'} for “{state.data.query || q}”
              {typeof state.data.took_ms === 'number' && <> · {formatNumber(state.data.took_ms)} ms</>}
            </div>
            {categories.length > 1 && (
              <div className="d-flex flex-wrap gap-2 align-items-center" role="group" aria-label="Filter results by category">
                <span className="small text-muted text-uppercase fw-semibold me-1">
                  <i className="bi bi-funnel me-1" aria-hidden="true" />
                  Category
                </span>
                {['ALL', ...categories].map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`fa-filter-chip ${categoryFilter === category ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(category)}
                    aria-pressed={categoryFilter === category}
                  >
                    {category === 'ALL' ? 'All' : category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visible.length ? (
            <div className="d-grid gap-3">
              {visible.map((result) => (
                <ResultCard key={result.file_id} result={result} />
              ))}
            </div>
          ) : (
            <div className="card fa-card">
              <EmptyState icon="bi-search" title="No matching documents found.">
                Try rephrasing your search.
              </EmptyState>
            </div>
          )}
        </>
      )}
    </div>
  );
}
