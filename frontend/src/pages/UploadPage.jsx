import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { ConfidenceBadge, FileIcon } from '../components/Badges';
import { uploadDocument } from '../api/documents';
import { getApiError } from '../api/client';
import { useAppConfig } from '../context/AppConfigContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useToast } from '../context/ToastContext';
import useAnalysisPolling from '../hooks/useAnalysisPolling';
import { buildAcceptMap, validateUploadFile } from '../utils/fileTypes';
import { formatBytes, plural } from '../utils/format';
import { displayPath } from '../utils/folders';

// Upload queue item lifecycle:
// invalid | queued -> uploading -> processing -> ready | stored | failed
//                              \-> duplicate (409) -> queued (upload anyway) | cancelled
//                              \-> error (400/413/network) -> queued (retry)
const ACTIVE_STATUSES = ['queued', 'uploading'];
const FINISHED_STATUSES = ['ready', 'stored', 'failed', 'invalid', 'cancelled', 'error'];

let itemCounter = 0;
function makeItem(file, error) {
  itemCounter += 1;
  return {
    key: `upload-${Date.now()}-${itemCounter}`,
    file,
    name: file.name,
    size: file.size,
    status: error ? 'invalid' : 'queued',
    progress: 0,
    error: error || null,
    fileId: null,
    existing: null,
    allowDuplicate: false,
    analysis: null,
  };
}

const TYPE_CHIPS = [
  { ext: 'pdf', label: 'PDF' },
  { ext: 'docx', label: 'DOCX' },
  { ext: 'txt', label: 'TXT' },
  { ext: 'png', label: 'PNG' },
  { ext: 'jpg', label: 'JPG' },
];

function UploadRow({ item, threshold, onResolved, onPollError, onCancel, onRemove, onRetry, onUploadAnyway }) {
  const polling = item.status === 'processing' && Boolean(item.fileId);
  const { analysis, error } = useAnalysisPolling(item.fileId, { enabled: polling });

  useEffect(() => {
    if (!polling) return;
    if (analysis && ['AWAITING_REVIEW', 'STORED', 'FAILED'].includes(analysis.status)) {
      onResolved(item.key, analysis);
    } else if (error) {
      onPollError(item.key, error);
    }
  }, [polling, analysis, error, item.key, onResolved, onPollError]);

  const confidence = item.analysis?.suggestions?.confidence;

  let statusNode = null;
  let actions = null;
  let bar = null;

  switch (item.status) {
    case 'queued':
      statusNode = (
        <span className="text-muted">
          <i className="bi bi-clock me-1" aria-hidden="true" />
          Queued
        </span>
      );
      actions = (
        <button type="button" className="btn btn-sm btn-link text-muted" onClick={() => onCancel(item.key)} aria-label={`Cancel ${item.name}`}>
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      );
      bar = <div className="progress fa-progress"><div className="progress-bar" style={{ width: '0%' }} /></div>;
      break;
    case 'uploading':
      statusNode = (
        <span className="text-primary fw-semibold">
          <i className="bi bi-arrow-up-circle me-1" aria-hidden="true" />
          Uploading {item.progress}%
        </span>
      );
      actions = (
        <button type="button" className="btn btn-sm btn-link text-muted" onClick={() => onCancel(item.key)} aria-label={`Cancel upload of ${item.name}`}>
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      );
      bar = (
        <div className="progress fa-progress" role="progressbar" aria-label={`Upload progress for ${item.name}`} aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-bar" style={{ width: `${item.progress}%` }} />
        </div>
      );
      break;
    case 'processing':
      statusNode = (
        <span className="fa-text-cyan fw-semibold">
          <span className="spinner-grow spinner-grow-sm me-2" aria-hidden="true" />
          Analysing…
        </span>
      );
      actions = (
        <Link to={`/documents/${item.fileId}/review`} className="btn btn-sm btn-outline-secondary">
          Open
        </Link>
      );
      bar = (
        <div className="progress fa-progress" role="progressbar" aria-label={`AI analysis in progress for ${item.name}`}>
          <div className="progress-bar progress-bar-striped progress-bar-animated fa-bar-cyan" style={{ width: '100%' }} />
        </div>
      );
      break;
    case 'ready':
      statusNode = (
        <span className="text-success fw-semibold d-inline-flex align-items-center gap-2 flex-wrap">
          <span>
            <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
            Analysis ready
          </span>
          {confidence !== undefined && confidence !== null && (
            <ConfidenceBadge confidence={confidence} threshold={threshold} showLabel={false} />
          )}
        </span>
      );
      actions = (
        <Link to={`/documents/${item.fileId}/review`} className="btn btn-sm btn-primary">
          <i className="bi bi-eye me-1" aria-hidden="true" />
          Review
        </Link>
      );
      break;
    case 'stored':
      statusNode = (
        <span className="text-success fw-semibold">
          <i className="bi bi-check2-all me-1" aria-hidden="true" />
          Stored
        </span>
      );
      actions = (
        <Link to={`/documents/${item.fileId}`} className="btn btn-sm btn-outline-primary">
          View
        </Link>
      );
      break;
    case 'failed':
      statusNode = (
        <span className="text-danger fw-semibold">
          <i className="bi bi-exclamation-octagon me-1" aria-hidden="true" />
          Processing failed
        </span>
      );
      actions = (
        <Link to={`/documents/${item.fileId}/review`} className="btn btn-sm btn-outline-danger">
          Review
        </Link>
      );
      break;
    case 'duplicate':
      statusNode = (
        <span className="text-warning-emphasis fw-semibold">
          <i className="bi bi-files me-1" aria-hidden="true" />
          Duplicate
        </span>
      );
      break;
    case 'error':
      statusNode = (
        <span className="text-danger fw-semibold">
          <i className="bi bi-x-octagon me-1" aria-hidden="true" />
          Upload failed
        </span>
      );
      actions = (
        <>
          {item.retryable !== false && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onRetry(item.key)}>
              Retry
            </button>
          )}
          <button type="button" className="btn btn-sm btn-link text-muted" onClick={() => onRemove(item.key)} aria-label={`Remove ${item.name}`}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </>
      );
      break;
    case 'invalid':
      statusNode = (
        <span className="text-danger fw-semibold">
          <i className="bi bi-slash-circle me-1" aria-hidden="true" />
          Not uploaded
        </span>
      );
      actions = (
        <button type="button" className="btn btn-sm btn-link text-muted" onClick={() => onRemove(item.key)} aria-label={`Remove ${item.name}`}>
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      );
      break;
    case 'cancelled':
      statusNode = <span className="text-muted">Cancelled</span>;
      actions = (
        <button type="button" className="btn btn-sm btn-link text-muted" onClick={() => onRemove(item.key)} aria-label={`Remove ${item.name}`}>
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      );
      break;
    default:
      break;
  }

  return (
    <li className={`fa-upload-row fa-upload-${item.status}`}>
      <div className="d-flex align-items-center gap-3">
        <FileIcon name={item.name} size={40} />
        <div className="flex-grow-1 min-w-0">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <div className="min-w-0">
              <div className="fw-semibold text-truncate" title={item.name}>
                {item.name}
              </div>
              <div className="small text-muted">{formatBytes(item.size)}</div>
            </div>
            <div className="d-flex align-items-center gap-2 flex-shrink-0 small" aria-live="polite">
              {statusNode}
              {actions}
            </div>
          </div>
          {bar && <div className="mt-2">{bar}</div>}
        </div>
      </div>

      {(item.status === 'invalid' || item.status === 'error') && item.error && (
        <div className="fa-upload-message text-danger small mt-2" role="alert">
          {item.error}
        </div>
      )}
      {item.status === 'failed' && (
        <div className="fa-upload-message text-danger small mt-2">
          {item.analysis?.error_message || 'The AI could not analyse this file.'} You can retry or enter the details
          manually on the review page.
        </div>
      )}
      {item.status === 'duplicate' && (
        <div className="fa-duplicate-box mt-3" role="alert">
          <div className="small mb-2">
            <strong>{item.error || 'You already have this file.'}</strong>
            {item.existing && (
              <>
                {' '}
                Existing copy:{' '}
                {item.existing.file_id ? (
                  <Link to={`/documents/${item.existing.file_id}`} className="fw-semibold">
                    {item.existing.name}
                  </Link>
                ) : (
                  <span className="fw-semibold">{item.existing.name}</span>
                )}{' '}
                in <span className="fw-semibold">{displayPath(item.existing.folder_path)}</span>.
              </>
            )}
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-warning fw-semibold" onClick={() => onUploadAnyway(item.key)}>
              Upload anyway
            </button>
            <button type="button" className="btn btn-sm btn-light" onClick={() => onCancel(item.key)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function UploadPage() {
  const { config } = useAppConfig();
  const { refresh } = useWorkspace();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const activeKey = useRef(null);
  const controllers = useRef(new Map());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const updateItem = useCallback((key, patch) => {
    if (!mounted.current) return;
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const acceptMap = useMemo(() => buildAcceptMap(config.allowed_extensions), [config.allowed_extensions]);

  const onDrop = useCallback(
    (accepted, rejections) => {
      const files = [...accepted, ...rejections.map((r) => r.file)];
      const newItems = files.map((file) =>
        makeItem(
          file,
          validateUploadFile(file, {
            allowedExtensions: config.allowed_extensions,
            maxUploadMb: config.max_upload_mb,
          }),
        ),
      );
      setItems((list) => [...list, ...newItems]);
      const invalid = newItems.filter((i) => i.status === 'invalid').length;
      if (invalid) toast.warning(`${plural(invalid, 'file')} could not be added. See the queue for details.`);
    },
    [config.allowed_extensions, config.max_upload_mb, toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: acceptMap, multiple: true });

  const startUpload = useCallback(
    async (item) => {
      activeKey.current = item.key;
      const controller = new AbortController();
      controllers.current.set(item.key, controller);
      updateItem(item.key, { status: 'uploading', progress: 0, error: null, existing: null });

      let patch;
      try {
        const data = await uploadDocument(item.file, {
          allowDuplicate: item.allowDuplicate,
          signal: controller.signal,
          onUploadProgress: (event) => {
            if (event.total) {
              // Hold at 99% until the server answers with 202.
              updateItem(item.key, { progress: Math.min(99, Math.round((event.loaded * 100) / event.total)) });
            }
          },
        });
        patch = { status: 'processing', progress: 100, fileId: data.file_id };
      } catch (err) {
        const error = getApiError(err);
        if (error.code === 'CANCELLED') {
          patch = { status: 'cancelled', error: null };
        } else if (error.status === 409 && error.code === 'DUPLICATE_FILE') {
          patch = { status: 'duplicate', existing: error.details.existing_file || null, error: error.details.message || null };
        } else if (error.status === 413) {
          patch = {
            status: 'error',
            retryable: false,
            error: error.details.message || `File is too large. The maximum size is ${config.max_upload_mb} MB.`,
          };
        } else {
          const fieldMessages = Object.values(error.fields || {}).filter(Boolean);
          patch = {
            status: 'error',
            // Network/server problems can be retried; a rejected file (400) will fail again.
            retryable: error.status === 0 || error.status >= 500 || error.status === 429,
            error: fieldMessages.length ? fieldMessages.join(' ') : error.message,
          };
        }
      } finally {
        controllers.current.delete(item.key);
      }
      activeKey.current = null;
      updateItem(item.key, patch);
    },
    [updateItem, config.max_upload_mb],
  );

  // Upload files one at a time, in the order they were added.
  useEffect(() => {
    if (activeKey.current) return;
    const next = items.find((item) => item.status === 'queued');
    if (next) startUpload(next);
  }, [items, startUpload]);

  // Warn before closing the tab while files are still uploading.
  const busy = items.some((item) => ACTIVE_STATUSES.includes(item.status));
  useEffect(() => {
    if (!busy) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [busy]);

  const handleResolved = useCallback(
    (key, analysis) => {
      const statusMap = { AWAITING_REVIEW: 'ready', STORED: 'stored', FAILED: 'failed' };
      updateItem(key, { status: statusMap[analysis.status] || 'ready', analysis });
      refresh();
      const name = analysis.original_name || 'Your file';
      if (analysis.status === 'FAILED') toast.error(`${name}: AI analysis failed.`);
      else toast.success(`${name} has been analysed.`);
    },
    [updateItem, refresh, toast],
  );

  const handlePollError = useCallback(
    (key, error) =>
      updateItem(key, {
        status: 'error',
        retryable: error.status !== 404,
        error: `Couldn't check the analysis status: ${error.message}`,
      }),
    [updateItem],
  );

  const handleCancel = useCallback(
    (key) => {
      const controller = controllers.current.get(key);
      if (controller) controller.abort();
      else updateItem(key, { status: 'cancelled', error: null });
    },
    [updateItem],
  );

  const handleRemove = useCallback((key) => setItems((list) => list.filter((item) => item.key !== key)), []);
  // Retry: if the file already reached the server, resume polling; otherwise upload again.
  const handleRetry = useCallback(
    (key) =>
      setItems((list) =>
        list.map((item) => {
          if (item.key !== key) return item;
          return item.fileId
            ? { ...item, status: 'processing', error: null }
            : { ...item, status: 'queued', error: null, progress: 0 };
        }),
      ),
    [],
  );
  const handleUploadAnyway = useCallback(
    (key) => updateItem(key, { status: 'queued', allowDuplicate: true, error: null, progress: 0 }),
    [updateItem],
  );

  const clearFinished = () => setItems((list) => list.filter((item) => !FINISHED_STATUSES.includes(item.status)));
  const cancelAll = () => items.filter((i) => ACTIVE_STATUSES.includes(i.status)).forEach((i) => handleCancel(i.key));

  const finishedCount = items.filter((item) => FINISHED_STATUSES.includes(item.status)).length;
  const readyCount = items.filter((item) => item.status === 'ready').length;
  const allowed = config.allowed_extensions;

  return (
    <div className="fa-page fa-narrow mx-auto">
      <div
        {...getRootProps({
          className: `fa-dropzone ${isDragActive ? 'is-active' : ''}`,
          'aria-label': 'Upload area. Drop files here or press Enter to browse.',
        })}
      >
        <input {...getInputProps({ 'aria-label': 'Choose files to upload' })} />
        <div className="fa-dropzone-icon" aria-hidden="true">
          <i className={`bi ${isDragActive ? 'bi-box-arrow-in-down' : 'bi-cloud-arrow-up'}`} />
        </div>
        <h2 className="h5 fw-bold mb-1">{isDragActive ? 'Drop to upload' : 'Drag & drop files here'}</h2>
        <p className="text-muted small mb-3">or click to browse from your computer</p>
        <button type="button" className="btn btn-primary fa-btn-gradient px-4">
          <i className="bi bi-folder2-open me-2" aria-hidden="true" />
          Browse files
        </button>
        <div className="d-flex justify-content-center flex-wrap gap-2 mt-4" aria-label="Supported file types">
          {TYPE_CHIPS.filter((chip) => allowed.includes(chip.ext) || (chip.ext === 'jpg' && allowed.includes('jpeg'))).map((chip) => (
            <span key={chip.ext} className="fa-type-chip">
              <FileIcon name={`file.${chip.ext}`} size={34} />
              <span>{chip.label}</span>
            </span>
          ))}
        </div>
        <p className="small text-muted mt-3 mb-0">
          Max file size: <strong>{config.max_upload_mb} MB</strong> · Multiple files supported
        </p>
      </div>

      {items.length > 0 && (
        <section className="card fa-card mt-4" aria-labelledby="upload-queue-title">
          <div className="card-header fa-card-header">
            <div className="d-flex align-items-center gap-2">
              <h2 className="fa-card-title" id="upload-queue-title">
                Upload queue
              </h2>
              <span className="badge rounded-pill fa-badge-soft">{plural(items.length, 'file')}</span>
            </div>
            <div className="d-flex gap-2">
              {busy && (
                <button type="button" className="btn btn-sm btn-link text-muted" onClick={cancelAll}>
                  Cancel all
                </button>
              )}
              {finishedCount > 0 && (
                <button type="button" className="btn btn-sm btn-link" onClick={clearFinished}>
                  Clear finished
                </button>
              )}
            </div>
          </div>
          <ul className="list-unstyled mb-0">
            {items.map((item) => (
              <UploadRow
                key={item.key}
                item={item}
                threshold={config.low_confidence_threshold}
                onResolved={handleResolved}
                onPollError={handlePollError}
                onCancel={handleCancel}
                onRemove={handleRemove}
                onRetry={handleRetry}
                onUploadAnyway={handleUploadAnyway}
              />
            ))}
          </ul>
          {(busy || readyCount > 0) && (
            <div className="card-footer bg-transparent small text-muted d-flex flex-wrap justify-content-between gap-2">
              <span>
                {busy ? (
                  <>
                    <i className="bi bi-info-circle me-1" aria-hidden="true" />
                    Keep this page open until uploads finish.
                  </>
                ) : (
                  `${plural(readyCount, 'document')} ready for review.`
                )}
              </span>
              <Link to="/review">Go to review queue</Link>
            </div>
          )}
        </section>
      )}

      <div className="row g-3 mt-2">
        {[
          { icon: 'bi-shield-lock', tone: 'teal', title: 'Private & secure', text: 'Files are checked, stored per user and only visible to you.' },
          { icon: 'bi-cpu', tone: 'cyan', title: 'AI analysis', text: 'Text is extracted (OCR for images) and classified automatically.' },
          { icon: 'bi-person-check', tone: 'purple', title: 'You stay in control', text: 'Review and edit every suggestion before it is saved.' },
        ].map((tip) => (
          <div key={tip.title} className="col-md-4">
            <div className="fa-tip h-100">
              <span className={`fa-icon-tile fa-icon-tile-sm fa-tone-${tip.tone}`} aria-hidden="true">
                <i className={`bi ${tip.icon}`} />
              </span>
              <div>
                <div className="fw-semibold small">{tip.title}</div>
                <div className="small text-muted">{tip.text}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
