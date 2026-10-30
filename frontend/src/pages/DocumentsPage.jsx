import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CategoryBadge, FileIcon, StatusBadge } from '../components/Badges';
import { EmptyState, ErrorState, SkeletonList } from '../components/Feedback';
import Pagination from '../components/Pagination';
import { listDocuments } from '../api/documents';
import { getApiError } from '../api/client';
import useLookups from '../hooks/useLookups';
import { FILE_TYPE_OPTIONS } from '../utils/fileTypes';
import { formatBytes, formatDate, formatNumber } from '../utils/format';
import { displayPath, flattenFolders } from '../utils/folders';

const PER_PAGE = 20;
const VIEW_KEY = 'fileai_documents_view';

const SORT_OPTIONS = [
  { value: 'uploaded_at:desc', label: 'Newest first' },
  { value: 'uploaded_at:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
];

const STATUS_OPTIONS = [
  { value: 'STORED', label: 'Stored' },
  { value: 'AWAITING_REVIEW', label: 'Awaiting review' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ALL', label: 'All statuses' },
];

function readView() {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'table';
  } catch {
    return 'table';
  }
}

export default function DocumentsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { categories, folders } = useLookups();
  const [view, setView] = useState(readView);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const category = params.get('category') || '';
  const type = params.get('type') || '';
  const folderId = params.get('folder_id') || '';
  const status = params.get('status') || 'STORED';
  const sortValue = SORT_OPTIONS.some((o) => o.value === params.get('sort')) ? params.get('sort') : 'uploaded_at:desc';
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);

  const flatFolders = useMemo(() => flattenFolders(folders), [folders]);
  const categoryOptions = useMemo(
    () => (category && !categories.includes(category) ? [category, ...categories] : categories),
    [categories, category],
  );

  useEffect(() => {
    let cancelled = false;
    const [sort, order] = sortValue.split(':');
    setState((s) => ({ ...s, loading: true, error: null }));
    listDocuments({ status, category, type, folder_id: folderId, sort, order, page, per_page: PER_PAGE })
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: getApiError(err), data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [status, category, type, folderId, sortValue, page, reloadKey]);

  const updateParam = (key, value, defaultValue = '') => {
    const next = new URLSearchParams(params);
    if (value && value !== defaultValue) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const changeView = (next) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage unavailable: keep the choice for this visit only */
    }
  };

  const hasFilters = Boolean(category || type || folderId || status !== 'STORED');
  const clearFilters = () => setParams(new URLSearchParams(sortValue !== 'uploaded_at:desc' ? { sort: sortValue } : {}));

  const items = state.data?.items || [];
  const total = state.data?.total ?? 0;
  const perPage = state.data?.per_page || PER_PAGE;
  const showStatus = status !== 'STORED';
  const selectedFolder = flatFolders.find((f) => String(f.folder_id) === String(folderId));

  const openDocument = (doc) => navigate(`/documents/${doc.file_id}`);

  return (
    <div className="fa-page">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
        <div>
          <h2 className="h5 fw-bold mb-0">
            All documents{' '}
            {state.data && <span className="text-muted fw-normal">({formatNumber(total)})</span>}
          </h2>
          <p className="text-muted small mb-0">Browse, filter and open the files FileAI has organised for you.</p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <div className="btn-group btn-group-sm" role="group" aria-label="View mode">
            <button
              type="button"
              className={`btn ${view === 'table' ? 'btn-primary' : 'btn-light'}`}
              onClick={() => changeView('table')}
              aria-pressed={view === 'table'}
              title="Table view"
            >
              <i className="bi bi-list-ul" aria-hidden="true" />
              <span className="visually-hidden">Table view</span>
            </button>
            <button
              type="button"
              className={`btn ${view === 'grid' ? 'btn-primary' : 'btn-light'}`}
              onClick={() => changeView('grid')}
              aria-pressed={view === 'grid'}
              title="Grid view"
            >
              <i className="bi bi-grid-3x2-gap" aria-hidden="true" />
              <span className="visually-hidden">Grid view</span>
            </button>
          </div>
          <Link to="/upload" className="btn btn-primary btn-sm">
            <i className="bi bi-cloud-arrow-up me-1" aria-hidden="true" />
            Upload
          </Link>
        </div>
      </div>

      <div className="card fa-card mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-sm-6 col-lg">
              <label htmlFor="filter-category" className="form-label fa-label small mb-1">
                Category
              </label>
              <select
                id="filter-category"
                className="form-select form-select-sm"
                value={category}
                onChange={(e) => updateParam('category', e.target.value)}
              >
                <option value="">All categories</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-6 col-lg">
              <label htmlFor="filter-type" className="form-label fa-label small mb-1">
                File type
              </label>
              <select
                id="filter-type"
                className="form-select form-select-sm"
                value={type}
                onChange={(e) => updateParam('type', e.target.value)}
              >
                <option value="">All types</option>
                {FILE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-6 col-lg">
              <label htmlFor="filter-folder" className="form-label fa-label small mb-1">
                Folder
              </label>
              <select
                id="filter-folder"
                className="form-select form-select-sm"
                value={folderId}
                onChange={(e) => updateParam('folder_id', e.target.value)}
              >
                <option value="">All folders</option>
                {folderId && !selectedFolder && <option value={folderId}>Selected folder</option>}
                {flatFolders.map((f) => (
                  <option key={f.folder_id} value={f.folder_id}>
                    {`${'  '.repeat(f.depth)}${f.depth ? '└ ' : ''}${f.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-6 col-lg">
              <label htmlFor="filter-status" className="form-label fa-label small mb-1">
                Status
              </label>
              <select
                id="filter-status"
                className="form-select form-select-sm"
                value={status}
                onChange={(e) => updateParam('status', e.target.value, 'STORED')}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-6 col-lg">
              <label htmlFor="filter-sort" className="form-label fa-label small mb-1">
                Sort by
              </label>
              <select
                id="filter-sort"
                className="form-select form-select-sm"
                value={sortValue}
                onChange={(e) => updateParam('sort', e.target.value, 'uploaded_at:desc')}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <div className="col-sm-6 col-lg-auto">
                <button type="button" className="btn btn-sm btn-link text-decoration-none w-100" onClick={clearFilters}>
                  <i className="bi bi-x-circle me-1" aria-hidden="true" />
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {state.loading && !state.data && (
        <div className="card fa-card">
          <div className="card-body">
            <SkeletonList rows={6} />
          </div>
        </div>
      )}

      {!state.loading && state.error && (
        <div className="card fa-card">
          <ErrorState
            title="Couldn't load documents"
            message={state.error.message}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        </div>
      )}

      {!state.error && state.data && items.length === 0 && !state.loading && (
        <div className="card fa-card">
          {hasFilters ? (
            <EmptyState
              icon="bi-funnel"
              title="No documents match these filters"
              action={
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={clearFilters}>
                  Clear filters
                </button>
              }
            >
              Try a different category, type or folder.
            </EmptyState>
          ) : (
            <EmptyState
              icon="bi-folder2-open"
              title="No documents yet"
              action={
                <Link to="/upload" className="btn btn-primary btn-sm">
                  Upload your first document
                </Link>
              }
            >
              Uploaded documents appear here once you approve the AI&apos;s suggestions.
            </EmptyState>
          )}
        </div>
      )}

      {!state.error && items.length > 0 && view === 'table' && (
        <div className={`card fa-card ${state.loading ? 'fa-loading-dim' : ''}`}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 fa-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="d-none d-lg-table-cell">
                    Folder
                  </th>
                  <th scope="col" className="d-none d-md-table-cell text-end">
                    Size
                  </th>
                  <th scope="col" className="d-none d-sm-table-cell">
                    Uploaded
                  </th>
                  {showStatus && <th scope="col">Status</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((doc) => (
                  <tr
                    key={doc.file_id}
                    className="fa-clickable"
                    tabIndex={0}
                    onClick={() => openDocument(doc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openDocument(doc);
                    }}
                    aria-label={`Open ${doc.name}`}
                  >
                    <td className="fa-name-cell">
                      <div className="d-flex align-items-center gap-3 min-w-0">
                        <FileIcon type={doc.file_type} name={doc.name} size={36} />
                        <div className="min-w-0">
                          <div className="fw-semibold text-truncate">{doc.title || doc.name}</div>
                          <div className="small text-muted text-truncate">{doc.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <CategoryBadge category={doc.category} />
                    </td>
                    <td className="d-none d-lg-table-cell small text-muted text-truncate fa-folder-cell">
                      {displayPath(doc.folder_path)}
                    </td>
                    <td className="d-none d-md-table-cell small text-end text-nowrap">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="d-none d-sm-table-cell small text-nowrap">{formatDate(doc.uploaded_at)}</td>
                    {showStatus && (
                      <td>
                        <StatusBadge status={doc.status} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!state.error && items.length > 0 && view === 'grid' && (
        <div className={`row g-3 ${state.loading ? 'fa-loading-dim' : ''}`}>
          {items.map((doc) => (
            <div key={doc.file_id} className="col-sm-6 col-xl-4">
              <Link to={`/documents/${doc.file_id}`} className="card fa-card fa-doc-card h-100 text-decoration-none">
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <FileIcon type={doc.file_type} name={doc.name} size={44} />
                    {showStatus ? <StatusBadge status={doc.status} /> : <CategoryBadge category={doc.category} />}
                  </div>
                  <div className="fw-semibold text-body text-truncate">{doc.title || doc.name}</div>
                  <div className="small text-muted text-truncate mb-2">{doc.name}</div>
                  {doc.summary && <p className="small text-body-secondary fa-clamp-2 mb-2">{doc.summary}</p>}
                  <div className="small text-muted d-flex flex-wrap gap-2">
                    <span className="text-truncate">
                      <i className="bi bi-folder2 me-1" aria-hidden="true" />
                      {displayPath(doc.folder_path)}
                    </span>
                  </div>
                  <div className="small text-muted d-flex justify-content-between mt-2">
                    <span>{formatDate(doc.uploaded_at)}</span>
                    <span>{formatBytes(doc.file_size_bytes)}</span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {!state.error && items.length > 0 && (
        <Pagination
          className="mt-3"
          page={state.data?.page || page}
          perPage={perPage}
          total={total}
          onChange={(p) => updateParam('page', String(p), '1')}
        />
      )}
    </div>
  );
}
