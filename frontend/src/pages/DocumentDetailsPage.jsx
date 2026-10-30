import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import FolderPathInput from '../components/FolderPathInput';
import MetadataFields, { mapApiFieldErrors } from '../components/MetadataFields';
import Modal from '../components/Modal';
import { CategoryBadge, ConfidenceBadge, FileIcon, KeywordChips, StatusBadge } from '../components/Badges';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import { deleteDocument, getDocument, getDownloadUrl, updateDocument } from '../api/documents';
import { getApiError } from '../api/client';
import { useAppConfig } from '../context/AppConfigContext';
import { useToast } from '../context/ToastContext';
import { useWorkspace } from '../context/WorkspaceContext';
import useLookups from '../hooks/useLookups';
import { downloadDocument, openDocumentInNewTab } from '../utils/download';
import { fileTypeLabel, isImageType, isInlinePreviewable, normaliseFileType } from '../utils/fileTypes';
import { formatBytes, formatDate, formatPercent, humanize } from '../utils/format';
import { displayPath, splitPath } from '../utils/folders';
import { cleanSegments, filenameError, folderSegmentError, validateDocumentMetadata } from '../utils/validation';

const EDITABLE_FIELDS = ['title', 'filename', 'category', 'subject', 'document_type', 'keywords', 'summary'];

function toEditForm(doc) {
  return {
    title: doc.title || '',
    filename: doc.name || '',
    category: doc.category || '',
    subject: doc.subject || '',
    document_type: doc.document_type || '',
    keywords: Array.isArray(doc.keywords) ? [...doc.keywords] : [],
    summary: doc.summary || '',
  };
}

/** Only send fields that actually changed. */
function diffChanges(original, form) {
  const changes = {};
  EDITABLE_FIELDS.forEach((field) => {
    const before = original[field];
    const after = form[field];
    if (field === 'keywords') {
      if (JSON.stringify(before) !== JSON.stringify(after)) changes.keywords = after;
    } else if (String(before ?? '').trim() !== String(after ?? '').trim()) {
      changes[field] = String(after ?? '').trim();
    }
  });
  return changes;
}

function TextPreview({ text }) {
  if (!text) {
    return (
      <EmptyState icon="bi-file-earmark-x" title="No preview available" compact>
        No text could be extracted from this document.
      </EmptyState>
    );
  }
  return <pre className="fa-text-preview">{text}</pre>;
}

function DocumentPreview({ doc }) {
  const type = normaliseFileType(doc.file_type || doc.name);
  const previewable = isInlinePreviewable(type);
  const [state, setState] = useState({ loading: previewable, url: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!previewable) return undefined;
    let cancelled = false;
    setState({ loading: true, url: null, error: null });
    getDownloadUrl(doc.file_id, { inline: true })
      .then((data) => {
        if (!cancelled) setState({ loading: false, url: data.url, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, url: null, error: getApiError(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [doc.file_id, previewable, attempt]);

  if (!previewable) return <TextPreview text={doc.text_preview} />;
  if (state.loading) return <LoadingState label="Loading preview…" />;
  if (state.error) {
    return (
      <>
        <ErrorState
          compact
          title="Preview unavailable"
          message={state.error.message}
          onRetry={() => setAttempt((n) => n + 1)}
        />
        {doc.text_preview && <TextPreview text={doc.text_preview} />}
      </>
    );
  }

  return (
    <div>
      {isImageType(type) ? (
        <div className="fa-preview-image-wrap">
          <img
            src={state.url}
            alt={doc.title || doc.name}
            className="fa-preview-image"
            onError={() => setState({ loading: false, url: null, error: { message: 'The image could not be displayed.' } })}
          />
        </div>
      ) : (
        <iframe src={state.url} title={`Preview of ${doc.name}`} className="fa-preview-frame" />
      )}
      {doc.text_preview && (
        <div className="mt-3">
          <button
            type="button"
            className="btn btn-sm btn-link px-0 text-decoration-none"
            onClick={() => setShowText((v) => !v)}
            aria-expanded={showText}
          >
            <i className={`bi ${showText ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`} aria-hidden="true" />
            {showText ? 'Hide extracted text' : 'Show extracted text'}
          </button>
          {showText && <TextPreview text={doc.text_preview} />}
        </div>
      )}
    </div>
  );
}

function DuplicateInfo({ duplicate }) {
  if (!duplicate) {
    return (
      <span className="text-success small">
        <i className="bi bi-check-circle me-1" aria-hidden="true" />
        None detected
      </span>
    );
  }
  const exact = duplicate.type === 'EXACT';
  return (
    <span className="small">
      <span className={`badge rounded-pill ${exact ? 'text-bg-danger' : 'text-bg-warning'} me-1`}>
        {exact ? 'Exact duplicate' : 'Similar'}
      </span>
      of{' '}
      {duplicate.file_id ? <Link to={`/documents/${duplicate.file_id}`}>{duplicate.name}</Link> : duplicate.name}
      {!exact && duplicate.score !== null && duplicate.score !== undefined && ` (${formatPercent(duplicate.score)})`}
    </span>
  );
}

export default function DocumentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { config } = useAppConfig();
  const { refresh } = useWorkspace();
  const { categories, folders, reload: reloadLookups } = useLookups();

  const [state, setState] = useState({ loading: true, error: null, doc: null });
  const [reloadKey, setReloadKey] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveSegments, setMoveSegments] = useState(['']);
  const [moveError, setMoveError] = useState('');

  const [modalBusy, setModalBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    getDocument(id)
      .then((doc) => {
        if (!cancelled) setState({ loading: false, error: null, doc });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: getApiError(err), doc: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const doc = state.doc;

  const applyUpdate = (updated) => {
    // PATCH returns the document object without text_preview / similar_documents; keep those.
    setState((s) => ({ ...s, doc: { ...s.doc, ...updated } }));
  };

  const patch = async (changes, successMessage) => {
    const updated = await updateDocument(id, changes);
    applyUpdate(updated || changes);
    toast.success(successMessage);
    return updated;
  };

  // ----- Edit metadata -----
  const startEdit = () => {
    setEditForm(toEditForm(doc));
    setEditErrors({});
    setEditError('');
    setEditing(true);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const validation = validateDocumentMetadata(editForm, { requireFolder: false });
    setEditErrors(validation);
    if (Object.keys(validation).length) return;
    const changes = diffChanges(toEditForm(doc), editForm);
    if (!Object.keys(changes).length) {
      setEditing(false);
      toast.info('No changes to save.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      await patch(changes, 'Metadata updated.');
      setEditing(false);
      if (changes.category) reloadLookups();
    } catch (err) {
      const apiError = getApiError(err);
      setEditErrors(mapApiFieldErrors(apiError.fields));
      setEditError(apiError.message);
    } finally {
      setSaving(false);
    }
  };

  // ----- Rename -----
  const openRename = () => {
    setRenameValue(doc.name || '');
    setRenameError('');
    setRenameOpen(true);
  };

  const saveRename = async (event) => {
    event.preventDefault();
    const error = filenameError(renameValue);
    if (error) {
      setRenameError(error);
      return;
    }
    if (renameValue.trim() === doc.name) {
      setRenameOpen(false);
      return;
    }
    setModalBusy(true);
    try {
      await patch({ filename: renameValue.trim() }, 'File renamed.');
      setRenameOpen(false);
    } catch (err) {
      const apiError = getApiError(err);
      setRenameError(apiError.fields.filename || apiError.message);
    } finally {
      setModalBusy(false);
    }
  };

  // ----- Move -----
  const openMove = () => {
    const segments = splitPath(doc.folder_path);
    setMoveSegments(segments.length ? segments : ['']);
    setMoveError('');
    setMoveOpen(true);
  };

  const saveMove = async (event) => {
    event.preventDefault();
    const segments = cleanSegments(moveSegments);
    if (!segments.length) {
      setMoveError('Choose an existing folder or type at least one folder name.');
      return;
    }
    const segmentError = segments.map(folderSegmentError).find(Boolean);
    if (segmentError) {
      setMoveError(segmentError);
      return;
    }
    if (segments.join('/') === splitPath(doc.folder_path).join('/')) {
      setMoveOpen(false);
      return;
    }
    setModalBusy(true);
    try {
      await patch({ folder_path: segments }, `Moved to ${segments.join(' / ')}.`);
      setMoveOpen(false);
      reloadLookups();
    } catch (err) {
      const apiError = getApiError(err);
      setMoveError(apiError.fields.folder_path || apiError.message);
    } finally {
      setModalBusy(false);
    }
  };

  // ----- Download / delete -----
  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocument(id);
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  const handleOpen = async () => {
    try {
      await openDocumentInNewTab(id);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDocument(id);
      toast.success(`${doc.name} was deleted.`);
      refresh();
      navigate('/documents', { replace: true });
    } catch (err) {
      toast.error(getApiError(err).message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // ----- Render -----
  if (state.loading && !doc) return <LoadingState label="Loading document…" />;

  if (state.error && !doc) {
    const notFound = state.error.status === 404;
    return (
      <div className="card fa-card fa-narrow mx-auto">
        <ErrorState
          title={notFound ? 'Document not found' : "Couldn't load this document"}
          message={notFound ? 'It may have been deleted, or it belongs to another account.' : state.error.message}
          onRetry={notFound ? undefined : () => setReloadKey((k) => k + 1)}
        />
        <div className="text-center pb-4">
          <Link to="/documents">Back to documents</Link>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  const segments = splitPath(doc.folder_path);
  const similar = doc.similar_documents || [];
  const needsReview = doc.status && doc.status !== 'STORED';

  return (
    <div className="fa-page">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="breadcrumb fa-breadcrumb mb-0">
          <li className="breadcrumb-item">
            <Link to="/documents">
              <i className="bi bi-folder2 me-1" aria-hidden="true" />
              Documents
            </Link>
          </li>
          {segments.map((segment, index) => (
            <li key={`${segment}-${index}`} className="breadcrumb-item">
              {index === segments.length - 1 && doc.folder_id ? (
                <Link to={`/folders?folder=${doc.folder_id}`}>{segment}</Link>
              ) : (
                segment
              )}
            </li>
          ))}
          <li className="breadcrumb-item active text-truncate" aria-current="page">
            {doc.name}
          </li>
        </ol>
      </nav>

      {needsReview && (
        <div className="alert alert-warning d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="status">
          <i className="bi bi-hourglass-split" aria-hidden="true" />
          <div className="flex-grow-1 small">
            {doc.status === 'FAILED'
              ? 'AI processing failed for this document. Review it to retry or enter the details manually.'
              : 'This document has not been approved yet, so it is not filed or searchable.'}
          </div>
          <Link to={`/documents/${doc.file_id}/review`} className="btn btn-sm btn-warning fw-semibold">
            Review now
          </Link>
        </div>
      )}

      <div className="row g-4">
        <div className="col-xl-7">
          <div className="card fa-card h-100">
            <div className="card-header fa-card-header">
              <div className="d-flex align-items-center gap-2 min-w-0">
                <FileIcon type={doc.file_type} name={doc.name} size={32} />
                <h2 className="fa-card-title text-truncate mb-0">Preview</h2>
              </div>
              <div className="d-flex gap-1">
                <button type="button" className="btn btn-sm fa-icon-button" onClick={handleOpen} title="Open in new tab">
                  <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                  <span className="visually-hidden">Open in new tab</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm fa-icon-button"
                  onClick={handleDownload}
                  disabled={downloading}
                  title="Download"
                >
                  <i className="bi bi-download" aria-hidden="true" />
                  <span className="visually-hidden">Download</span>
                </button>
              </div>
            </div>
            <div className="card-body fa-preview-body">
              <DocumentPreview doc={doc} />
            </div>
          </div>
        </div>

        <div className="col-xl-5">
          <div className="card fa-card">
            <div className="card-body p-4">
              {!editing ? (
                <>
                  <div className="mb-3">
                    <h2 className="h5 fw-bold mb-1 text-break">{doc.title || doc.name}</h2>
                    <div className="small text-muted text-break">{doc.name}</div>
                  </div>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <CategoryBadge category={doc.category} />
                    <StatusBadge status={doc.status} />
                    {doc.is_user_approved && (
                      <span className="badge rounded-pill fa-status fa-status-info">
                        <i className="bi bi-person-check me-1" aria-hidden="true" />
                        Approved by you
                      </span>
                    )}
                  </div>

                  <h3 className="fa-section-label">AI summary</h3>
                  <div className="fa-summary-box mb-3">{doc.summary || <span className="text-muted">No summary.</span>}</div>

                  <h3 className="fa-section-label">Keywords</h3>
                  <KeywordChips keywords={doc.keywords} className="mb-3" />

                  <dl className="fa-meta-grid mb-3">
                    <div>
                      <dt>Folder</dt>
                      <dd>
                        {doc.folder_id ? (
                          <Link to={`/folders?folder=${doc.folder_id}`}>{displayPath(doc.folder_path)}</Link>
                        ) : (
                          displayPath(doc.folder_path)
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Subject</dt>
                      <dd>{doc.subject || '—'}</dd>
                    </div>
                    <div>
                      <dt>Document type</dt>
                      <dd>{doc.document_type || '—'}</dd>
                    </div>
                    <div>
                      <dt>File type</dt>
                      <dd>
                        {doc.file_type || '—'} <span className="text-muted">· {fileTypeLabel(doc.file_type)}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>Size</dt>
                      <dd>{formatBytes(doc.file_size_bytes)}</dd>
                    </div>
                    <div>
                      <dt>Uploaded</dt>
                      <dd>{formatDate(doc.uploaded_at, { withTime: true })}</dd>
                    </div>
                    <div>
                      <dt>Original name</dt>
                      <dd className="text-break">{doc.original_name || '—'}</dd>
                    </div>
                    <div>
                      <dt>Last updated</dt>
                      <dd>{formatDate(doc.updated_at, { withTime: true })}</dd>
                    </div>
                    <div>
                      <dt>Extraction method</dt>
                      <dd>{doc.extraction_method ? humanize(doc.extraction_method) : '—'}</dd>
                    </div>
                    <div>
                      <dt>AI confidence</dt>
                      <dd>
                        <ConfidenceBadge confidence={doc.confidence} threshold={config.low_confidence_threshold} />
                      </dd>
                    </div>
                    <div className="fa-meta-wide">
                      <dt>Duplicate status</dt>
                      <dd>
                        <DuplicateInfo duplicate={doc.duplicate_of} />
                      </dd>
                    </div>
                  </dl>

                  <div className="fa-actions-grid">
                    <button type="button" className="btn btn-light" onClick={startEdit}>
                      <i className="bi bi-pencil me-1" aria-hidden="true" />
                      Edit
                    </button>
                    <button type="button" className="btn btn-light" onClick={openRename}>
                      <i className="bi bi-input-cursor-text me-1" aria-hidden="true" />
                      Rename
                    </button>
                    <button type="button" className="btn btn-light" onClick={openMove}>
                      <i className="bi bi-arrows-move me-1" aria-hidden="true" />
                      Move
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
                      {downloading ? (
                        <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                      ) : (
                        <i className="bi bi-download me-1" aria-hidden="true" />
                      )}
                      Download
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger fa-actions-wide"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <i className="bi bi-trash3 me-1" aria-hidden="true" />
                      Delete document
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={saveEdit} noValidate>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h2 className="h6 fw-bold mb-0">Edit metadata</h2>
                    <button type="button" className="btn-close" aria-label="Cancel editing" onClick={() => setEditing(false)} />
                  </div>
                  {editError && (
                    <div className="alert alert-danger small" role="alert">
                      {editError}
                    </div>
                  )}
                  <MetadataFields
                    values={editForm}
                    onChange={(name, value) => {
                      setEditForm((f) => ({ ...f, [name]: value }));
                      if (editErrors[name]) setEditErrors((e) => ({ ...e, [name]: undefined }));
                    }}
                    errors={editErrors}
                    categories={categories}
                    showFolder={false}
                    disabled={saving}
                  />
                  <div className="d-flex justify-content-end gap-2 mt-4">
                    <button type="button" className="btn btn-light" onClick={() => setEditing(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                      Save changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {similar.length > 0 && !editing && (
            <div className="card fa-card mt-4">
              <div className="card-header fa-card-header">
                <h2 className="fa-card-title mb-0">Similar documents</h2>
              </div>
              <ul className="list-unstyled mb-0">
                {similar.map((item) => (
                  <li key={item.file_id} className="fa-similar-row">
                    <FileIcon name={item.name} size={32} />
                    <Link to={`/documents/${item.file_id}`} className="text-truncate flex-grow-1">
                      {item.name}
                    </Link>
                    <span className="badge rounded-pill fa-badge-soft">{formatPercent(item.similarity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Modal
        show={renameOpen}
        title="Rename file"
        icon="bi-input-cursor-text"
        onClose={() => !modalBusy && setRenameOpen(false)}
        closeDisabled={modalBusy}
      >
        <form onSubmit={saveRename} noValidate>
          <label htmlFor="rename-input" className="form-label fa-label">
            New filename
          </label>
          <input
            id="rename-input"
            type="text"
            className={`form-control ${renameError ? 'is-invalid' : ''}`}
            value={renameValue}
            onChange={(e) => {
              setRenameValue(e.target.value);
              setRenameError('');
            }}
            maxLength={255}
          />
          {renameError && <div className="invalid-feedback">{renameError}</div>}
          <div className="d-flex justify-content-end gap-2 mt-4">
            <button type="button" className="btn btn-light" onClick={() => setRenameOpen(false)} disabled={modalBusy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={modalBusy}>
              {modalBusy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              Rename
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        show={moveOpen}
        title="Move to folder"
        icon="bi-folder-symlink"
        size="lg"
        onClose={() => !modalBusy && setMoveOpen(false)}
        closeDisabled={modalBusy}
      >
        <form onSubmit={saveMove} noValidate>
          <p className="small text-muted">
            Currently in <strong>{displayPath(doc.folder_path)}</strong>. Pick an existing folder or type a new path —
            missing folders are created automatically.
          </p>
          <FolderPathInput
            id="move-folder"
            value={moveSegments}
            onChange={(next) => {
              setMoveSegments(next);
              setMoveError('');
            }}
            folders={folders}
            invalid={Boolean(moveError)}
            disabled={modalBusy}
          />
          {moveError && <div className="invalid-feedback d-block">{moveError}</div>}
          <div className="d-flex justify-content-end gap-2 mt-4">
            <button type="button" className="btn btn-light" onClick={() => setMoveOpen(false)} disabled={modalBusy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={modalBusy}>
              {modalBusy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              Move here
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        show={confirmDelete}
        title="Delete this document?"
        confirmLabel="Delete permanently"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        icon="bi-trash3"
      >
        <strong>{doc.name}</strong> and its AI metadata will be permanently deleted. This can&apos;t be undone.
      </ConfirmModal>
    </div>
  );
}
