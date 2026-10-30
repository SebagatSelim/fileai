import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfidenceBadge, FileIcon, StatusBadge } from '../components/Badges';
import { EmptyState, ErrorState, SkeletonList } from '../components/Feedback';
import { listDocuments } from '../api/documents';
import { getApiError } from '../api/client';
import { useAppConfig } from '../context/AppConfigContext';
import { formatBytes, formatRelativeTime, plural } from '../utils/format';

const QUERY = { sort: 'uploaded_at', order: 'desc', per_page: 100, page: 1 };
const REFRESH_WHILE_PROCESSING_MS = 5000;

function QueueRow({ doc, threshold }) {
  const name = doc.original_name || doc.name;
  const isFailed = doc.status === 'FAILED';
  const isProcessing = doc.status === 'PROCESSING' || doc.status === 'UPLOADED';
  return (
    <li className="fa-queue-row">
      <FileIcon type={doc.file_type} name={name} size={44} />
      <div className="flex-grow-1 min-w-0">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="fw-semibold text-truncate" title={name}>
            {name}
          </span>
          {doc.duplicate_of && (
            <span className="badge rounded-pill text-bg-warning">
              <i className="bi bi-files me-1" aria-hidden="true" />
              {doc.duplicate_of.type === 'EXACT' ? 'Duplicate' : 'Similar file'}
            </span>
          )}
        </div>
        <div className="small text-muted d-flex flex-wrap gap-2">
          <span>{doc.file_type}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(doc.file_size_bytes)}</span>
          <span aria-hidden="true">·</span>
          <span>Uploaded {formatRelativeTime(doc.uploaded_at)}</span>
        </div>
        {isFailed && doc.error_message && <div className="small text-danger mt-1">{doc.error_message}</div>}
        {!isFailed && doc.title && <div className="small mt-1 text-truncate">Suggested title: {doc.title}</div>}
      </div>
      <div className="d-flex align-items-center gap-2 flex-shrink-0">
        {!isFailed && !isProcessing && doc.confidence !== null && doc.confidence !== undefined && (
          <span className="d-none d-md-inline">
            <ConfidenceBadge confidence={doc.confidence} threshold={threshold} showLabel={false} />
          </span>
        )}
        <StatusBadge status={doc.status} className="d-none d-sm-inline-flex" />
        <Link
          to={`/documents/${doc.file_id}/review`}
          className={`btn btn-sm ${isFailed ? 'btn-outline-danger' : isProcessing ? 'btn-light' : 'btn-primary'}`}
        >
          {isProcessing ? 'View' : 'Review'}
        </Link>
      </div>
    </li>
  );
}

function Section({ title, icon, tone, items, threshold, description }) {
  if (!items.length) return null;
  return (
    <section className="card fa-card mb-4">
      <div className="card-header fa-card-header">
        <div className="d-flex align-items-center gap-2">
          <span className={`fa-icon-tile fa-icon-tile-sm fa-tone-${tone}`} aria-hidden="true">
            <i className={`bi ${icon}`} />
          </span>
          <div>
            <h2 className="fa-card-title mb-0">
              {title} <span className="text-muted fw-normal">({items.length})</span>
            </h2>
            {description && <div className="fa-card-subtitle">{description}</div>}
          </div>
        </div>
      </div>
      <ul className="list-unstyled mb-0">
        {items.map((doc) => (
          <QueueRow key={doc.file_id} doc={doc} threshold={threshold} />
        ))}
      </ul>
    </section>
  );
}

export default function ReviewQueuePage() {
  const { config } = useAppConfig();
  const [state, setState] = useState({ loading: true, error: null, awaiting: [], failed: [], processing: [] });

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [awaiting, failed, processing] = await Promise.all([
        listDocuments({ ...QUERY, status: 'AWAITING_REVIEW' }),
        listDocuments({ ...QUERY, status: 'FAILED' }),
        listDocuments({ ...QUERY, status: 'PROCESSING' }).catch(() => ({ items: [] })),
      ]);
      setState({
        loading: false,
        error: null,
        awaiting: awaiting.items || [],
        failed: failed.items || [],
        processing: processing.items || [],
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: getApiError(err) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While documents are still being analysed, refresh quietly every few seconds.
  const processingCount = state.processing.length;
  useEffect(() => {
    if (!processingCount) return undefined;
    const timer = window.setInterval(() => load({ silent: true }), REFRESH_WHILE_PROCESSING_MS);
    return () => window.clearInterval(timer);
  }, [processingCount, load]);

  const total = state.awaiting.length + state.failed.length;

  return (
    <div className="fa-page">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-4">
        <div>
          <h2 className="h5 fw-bold mb-1">Documents waiting for you</h2>
          <p className="text-muted small mb-0">
            Approve or edit the AI&apos;s suggestions so your files are filed and searchable.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-light btn-sm" onClick={() => load()} disabled={state.loading}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
            Refresh
          </button>
          <Link to="/upload" className="btn btn-primary btn-sm">
            <i className="bi bi-cloud-arrow-up me-1" aria-hidden="true" />
            Upload more
          </Link>
        </div>
      </div>

      {state.loading && !total && !state.processing.length && (
        <div className="card fa-card">
          <div className="card-body">
            <SkeletonList rows={4} />
          </div>
        </div>
      )}

      {!state.loading && state.error && (
        <div className="card fa-card">
          <ErrorState title="Couldn't load the review queue" message={state.error.message} onRetry={() => load()} />
        </div>
      )}

      {!state.error && !state.loading && total === 0 && !state.processing.length && (
        <div className="card fa-card">
          <EmptyState
            icon="bi-check2-all"
            title="You're all caught up"
            action={
              <Link to="/upload" className="btn btn-primary">
                Upload documents
              </Link>
            }
          >
            Nothing needs reviewing right now. New uploads will appear here once the AI has analysed them.
          </EmptyState>
        </div>
      )}

      {!state.error && (
        <>
          <Section
            title="Awaiting review"
            icon="bi-hourglass-split"
            tone="amber"
            items={state.awaiting}
            threshold={config.low_confidence_threshold}
            description={`${plural(state.awaiting.length, 'document')} analysed by AI and ready to approve`}
          />
          <Section
            title="Processing failed"
            icon="bi-exclamation-octagon"
            tone="red"
            items={state.failed}
            threshold={config.low_confidence_threshold}
            description="Retry the analysis or enter the details manually"
          />
          <Section
            title="Still analysing"
            icon="bi-cpu"
            tone="cyan"
            items={state.processing}
            threshold={config.low_confidence_threshold}
            description="These will move to “Awaiting review” automatically"
          />
        </>
      )}
    </div>
  );
}
