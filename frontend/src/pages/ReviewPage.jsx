import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfidenceRing from '../components/ConfidenceRing';
import ConfirmModal from '../components/ConfirmModal';
import MetadataFields, { mapApiFieldErrors } from '../components/MetadataFields';
import { ConfidenceBadge, FileIcon, StatusBadge, isLowConfidence } from '../components/Badges';
import { ErrorState, LoadingState } from '../components/Feedback';
import { approveDocument, deleteDocument, reprocessDocument } from '../api/documents';
import { getApiError } from '../api/client';
import { useAppConfig } from '../context/AppConfigContext';
import { useToast } from '../context/ToastContext';
import { useWorkspace } from '../context/WorkspaceContext';
import useAnalysisPolling from '../hooks/useAnalysisPolling';
import useLookups from '../hooks/useLookups';
import { cleanSegments, validateDocumentMetadata } from '../utils/validation';
import { formatPercent } from '../utils/format';
import { displayPath } from '../utils/folders';
import { openDocumentInNewTab } from '../utils/download';

const EMPTY_FORM = {
  title: '',
  filename: '',
  category: '',
  subject: '',
  document_type: '',
  folder_path: [''],
  keywords: [],
  summary: '',
};

/** Prefill from AI suggestions; without suggestions, derive sensible defaults from the original name. */
export function buildReviewForm(analysis) {
  const s = analysis?.suggestions;
  if (s) {
    return {
      title: s.title || '',
      filename: s.suggested_filename || analysis.original_name || '',
      category: s.category || '',
      subject: s.subject || '',
      document_type: s.document_type || '',
      folder_path: s.suggested_folder_path?.length ? [...s.suggested_folder_path] : [''],
      keywords: Array.isArray(s.keywords) ? [...s.keywords] : [],
      summary: s.summary || '',
    };
  }
  const original = analysis?.original_name || '';
  const stem = original.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return { ...EMPTY_FORM, title: stem, filename: original };
}

const PROCESSING_STEPS = [
  { icon: 'bi-file-earmark-text', label: 'Extracting text (OCR for scans and images)' },
  { icon: 'bi-cpu', label: 'Classifying category, subject and type' },
  { icon: 'bi-tags', label: 'Generating title, keywords and summary' },
  { icon: 'bi-folder2-open', label: 'Recommending a filename and folder' },
  { icon: 'bi-files', label: 'Checking for similar documents' },
];

function ProcessingCard({ analysis, onDiscard }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((s) => (s + 1) % PROCESSING_STEPS.length), 1800);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="card fa-card fa-narrow mx-auto">
      <div className="card-body p-4 p-md-5 text-center">
        <div className="fa-analysing-orb mx-auto mb-4" aria-hidden="true">
          <i className="bi bi-stars" />
        </div>
        <h2 className="h5 fw-bold mb-1">Analysing {analysis?.original_name || 'your document'}…</h2>
        <p className="text-muted small mb-4">
          This usually takes less than 30 seconds. You can leave this page — the document will wait for you in the
          Review Queue.
        </p>
        <ul className="list-unstyled text-start mx-auto fa-steps-list mb-4" aria-live="polite">
          {PROCESSING_STEPS.map((s, i) => (
            <li key={s.label} className={i === step ? 'active' : i < step ? 'done' : ''}>
              <i className={`bi ${i < step ? 'bi-check-circle-fill' : s.icon}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="d-flex justify-content-center gap-2">
          <Link to="/review" className="btn btn-light">
            Go to review queue
          </Link>
          <button type="button" className="btn btn-outline-danger" onClick={onDiscard}>
            Discard upload
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { config } = useAppConfig();
  const { refresh } = useWorkspace();
  const { categories, folders } = useLookups();
  const { analysis, setAnalysis, error, loading, restart } = useAnalysisPolling(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const status = analysis?.status;
  const reviewable = status === 'AWAITING_REVIEW' || status === 'FAILED';

  // Fill the form once the analysis is ready. Manual edits are kept if a
  // retried analysis fails again (no suggestions to replace them with).
  if (reviewable && !initialized) {
    setInitialized(true);
    if (analysis.suggestions || form === EMPTY_FORM) setForm(buildReviewForm(analysis));
  }

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const threshold = config.low_confidence_threshold;
  const suggestions = analysis?.suggestions;
  const confidence = suggestions?.confidence;
  const lowConfidence = isLowConfidence(confidence, threshold);
  const similar = analysis?.similar_documents || [];

  const handleApprove = async (event) => {
    event.preventDefault();
    setFormError('');
    const validation = validateDocumentMetadata(form);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      filename: form.filename.trim(),
      folder_path: cleanSegments(form.folder_path),
      category: form.category.trim(),
      keywords: form.keywords,
      summary: form.summary.trim(),
    };
    if (form.subject.trim()) payload.subject = form.subject.trim();
    if (form.document_type.trim()) payload.document_type = form.document_type.trim();

    setSaving(true);
    try {
      const doc = await approveDocument(id, payload);
      toast.success(`Saved to ${displayPath(doc?.folder_path || payload.folder_path)}.`, { title: 'Document stored' });
      refresh();
      navigate(`/documents/${id}`);
    } catch (err) {
      const apiError = getApiError(err);
      setErrors(mapApiFieldErrors(apiError.fields));
      setFormError(apiError.message);
      setSaving(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await reprocessDocument(id);
      setAnalysis((a) => ({ ...a, status: 'PROCESSING', error_message: null }));
      setInitialized(false);
      restart();
      toast.info('Processing restarted.');
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setRetrying(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await deleteDocument(id);
      toast.success('Upload discarded.');
      refresh();
      navigate('/upload');
    } catch (err) {
      toast.error(getApiError(err).message);
      setDiscarding(false);
      setConfirmDiscard(false);
    }
  };

  const openOriginal = async () => {
    try {
      await openDocumentInNewTab(id);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  const discardModal = (
    <ConfirmModal
      show={confirmDiscard}
      title="Discard this upload?"
      confirmLabel="Discard upload"
      busy={discarding}
      onConfirm={handleDiscard}
      onCancel={() => setConfirmDiscard(false)}
      icon="bi-trash3"
    >
      <strong>{analysis?.original_name || 'This file'}</strong> and its AI analysis will be permanently deleted. This
      can&apos;t be undone.
    </ConfirmModal>
  );

  if (!analysis && loading) return <LoadingState label="Loading AI analysis…" />;

  if (!analysis && error) {
    const notFound = error.status === 404;
    return (
      <div className="card fa-card fa-narrow mx-auto">
        <ErrorState
          title={notFound ? 'Document not found' : "Couldn't load the analysis"}
          message={notFound ? 'It may have been deleted or it belongs to another account.' : error.message}
          onRetry={notFound ? undefined : restart}
        />
        <div className="text-center pb-4">
          <Link to="/review">Back to review queue</Link>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  if (status === 'PROCESSING' || status === 'UPLOADED') {
    return (
      <>
        <ProcessingCard analysis={analysis} onDiscard={() => setConfirmDiscard(true)} />
        {discardModal}
      </>
    );
  }

  if (status === 'STORED') {
    return (
      <div className="card fa-card fa-narrow mx-auto">
        <div className="card-body p-5 text-center">
          <div className="fa-state-icon fa-state-icon-success mx-auto mb-3">
            <i className="bi bi-check2-circle" aria-hidden="true" />
          </div>
          <h2 className="h5 fw-bold">Already approved</h2>
          <p className="text-muted small">
            {analysis.original_name || 'This document'} has been reviewed and stored. You can still edit its metadata
            from the document page.
          </p>
          <Link to={`/documents/${id}`} className="btn btn-primary">
            View document
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="fa-page" onSubmit={handleApprove} noValidate>
      <div className="row g-4">
        <div className="col-xl-8">
          <div className="card fa-card">
            <div className="card-header fa-card-header fa-review-header">
              <div className="d-flex align-items-center gap-3 min-w-0">
                <span className="fa-icon-tile fa-tone-teal fa-icon-tile-lg" aria-hidden="true">
                  <i className="bi bi-stars" />
                </span>
                <div className="min-w-0">
                  <h2 className="fa-card-title mb-0">AI Analysis Results</h2>
                  <div className="fa-card-subtitle text-truncate">
                    {analysis.original_name} · {analysis.file_type || 'File'}
                  </div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className="text-end d-none d-sm-block">
                  <div className="small text-muted">AI confidence</div>
                  <ConfidenceBadge confidence={confidence} threshold={threshold} />
                </div>
                <ConfidenceRing value={confidence} threshold={threshold} />
              </div>
            </div>

            <div className="card-body p-4">
              {status === 'FAILED' && (
                <div className="alert alert-danger d-flex flex-column flex-sm-row gap-3 align-items-sm-center" role="alert">
                  <i className="bi bi-exclamation-octagon fs-4" aria-hidden="true" />
                  <div className="flex-grow-1">
                    <div className="fw-semibold">AI processing failed</div>
                    <div className="small">
                      {analysis.error_message || 'The document could not be analysed.'} You can retry, or fill in the
                      details below and approve manually.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm text-nowrap"
                    onClick={handleRetry}
                    disabled={retrying}
                  >
                    {retrying ? (
                      <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                    ) : (
                      <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                    )}
                    Retry processing
                  </button>
                </div>
              )}

              {lowConfidence && (
                <div className="alert fa-alert-lowconf d-flex gap-3" role="status">
                  <i className="bi bi-exclamation-triangle-fill fs-5" aria-hidden="true" />
                  <div className="small">
                    <div className="fw-semibold">Low confidence ({formatPercent(confidence)})</div>
                    The AI wasn&apos;t sure about this document. Please check the category, folder and title carefully
                    before saving.
                  </div>
                </div>
              )}

              {similar.length > 0 && (
                <div className="alert alert-warning fa-similar" role="status">
                  <div className="d-flex gap-2 align-items-center fw-semibold mb-1">
                    <i className="bi bi-files" aria-hidden="true" />
                    Similar {similar.length === 1 ? 'document' : 'documents'} found
                  </div>
                  <p className="small mb-2">
                    This file looks like something you already have. You can still save it, or discard this upload.
                  </p>
                  <ul className="list-unstyled mb-0 d-grid gap-2">
                    {similar.map((doc) => (
                      <li key={doc.file_id} className="d-flex align-items-center gap-2 small">
                        <FileIcon name={doc.name} size={28} />
                        <Link to={`/documents/${doc.file_id}`} className="fw-semibold text-truncate">
                          {doc.name}
                        </Link>
                        <span className="badge rounded-pill text-bg-warning ms-auto">
                          {formatPercent(doc.similarity)} similar
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {formError && (
                <div className="alert alert-danger small" role="alert">
                  {formError}
                </div>
              )}

              <MetadataFields
                values={form}
                onChange={setField}
                errors={errors}
                categories={categories}
                folders={folders}
                aiHints={Boolean(suggestions)}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="col-xl-4">
          <div className="fa-sticky d-grid gap-3">
            <div className="card fa-card">
              <div className="card-body">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <FileIcon type={analysis.file_type} name={analysis.original_name} size={48} />
                  <div className="min-w-0">
                    <div className="fw-semibold text-truncate" title={analysis.original_name}>
                      {analysis.original_name}
                    </div>
                    <StatusBadge status={status} />
                  </div>
                </div>
                <dl className="fa-dl small mb-3">
                  <dt>Will be saved as</dt>
                  <dd className="text-break">{form.filename || '—'}</dd>
                  <dt>In folder</dt>
                  <dd>{displayPath(form.folder_path, 'Choose a folder')}</dd>
                  <dt>Category</dt>
                  <dd>{form.category || '—'}</dd>
                </dl>
                <button type="button" className="btn btn-light btn-sm w-100" onClick={openOriginal}>
                  <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
                  Open original file
                </button>
              </div>
            </div>

            <div className="card fa-card">
              <div className="card-body d-grid gap-2">
                <button type="submit" className="btn btn-primary fa-btn-gradient py-2" disabled={saving}>
                  {saving ? (
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  ) : (
                    <i className="bi bi-check2-circle me-2" aria-hidden="true" />
                  )}
                  Approve &amp; Save
                </button>
                {suggestions && (
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => {
                      setForm(buildReviewForm(analysis));
                      setErrors({});
                    }}
                    disabled={saving}
                  >
                    <i className="bi bi-arrow-counterclockwise me-2" aria-hidden="true" />
                    Reset to AI suggestions
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => setConfirmDiscard(true)}
                  disabled={saving}
                >
                  <i className="bi bi-trash3 me-2" aria-hidden="true" />
                  Discard upload
                </button>
                <p className="small text-muted mb-0 mt-1">
                  <i className="bi bi-info-circle me-1" aria-hidden="true" />
                  Nothing is filed until you approve. Missing folders are created automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {discardModal}
    </form>
  );
}
