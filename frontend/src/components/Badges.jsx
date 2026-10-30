// Small presentational badges and icons.
import { formatPercent } from '../utils/format';
import { fileTypeClass, fileTypeIcon, normaliseFileType } from '../utils/fileTypes';
import { categoryColor, categoryIcon, statusMeta } from '../utils/labels';

export function StatusBadge({ status, className = '' }) {
  const meta = statusMeta(status);
  return (
    <span className={`badge rounded-pill fa-status fa-status-${meta.tone} ${className}`}>
      <i className={`bi ${meta.icon} me-1`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/**
 * AI confidence badge. Below `threshold` it is shown as a warning so the user
 * double-checks the suggestions (docs/07 §7.5).
 */
export function ConfidenceBadge({ confidence, threshold = 0.6, className = '', showLabel = true }) {
  if (confidence === null || confidence === undefined) {
    return <span className={`badge rounded-pill text-bg-light border ${className}`}>Confidence n/a</span>;
  }
  const value = Number(confidence);
  let tone = 'high';
  let label = 'High';
  let icon = 'bi-shield-check';
  if (value < threshold) {
    tone = 'low';
    label = 'Low — please check';
    icon = 'bi-exclamation-triangle';
  } else if (value < 0.85) {
    tone = 'medium';
    label = 'Medium';
    icon = 'bi-shield';
  }
  return (
    <span className={`badge rounded-pill fa-confidence fa-confidence-${tone} ${className}`} title="AI confidence">
      <i className={`bi ${icon} me-1`} aria-hidden="true" />
      {formatPercent(value)}
      {showLabel && <span className="fw-normal"> · {label}</span>}
    </span>
  );
}

export function isLowConfidence(confidence, threshold = 0.6) {
  return confidence !== null && confidence !== undefined && Number(confidence) < threshold;
}

/** Coloured tile with a bootstrap-icons file icon. */
export function FileIcon({ type, name, size = 40, className = '' }) {
  const key = type || name;
  const label = normaliseFileType(key) || 'File';
  return (
    <span
      className={`fa-file-icon ${fileTypeClass(key)} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.48 }}
      title={label}
    >
      <i className={`bi ${fileTypeIcon(key)}`} aria-hidden="true" />
      <span className="visually-hidden">{label} file</span>
    </span>
  );
}

export function CategoryBadge({ category, className = '' }) {
  if (!category) {
    return <span className={`badge rounded-pill text-bg-light border fw-medium ${className}`}>Uncategorised</span>;
  }
  const color = categoryColor(category);
  return (
    <span
      className={`badge rounded-pill fa-category-badge ${className}`}
      style={{ color, backgroundColor: `${color}1a`, borderColor: `${color}40` }}
    >
      <i className={`bi ${categoryIcon(category)} me-1`} aria-hidden="true" />
      {category}
    </span>
  );
}

export function KeywordChips({ keywords = [], className = '' }) {
  if (!keywords || !keywords.length) return <span className="text-muted small">No keywords</span>;
  return (
    <div className={`d-flex flex-wrap gap-2 ${className}`}>
      {keywords.map((keyword) => (
        <span key={keyword} className="fa-chip">
          <span className="fa-chip-hash" aria-hidden="true">#</span>
          {keyword}
        </span>
      ))}
    </div>
  );
}
