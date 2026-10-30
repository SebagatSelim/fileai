// Loading, empty and error states used across every page.

export function Spinner({ size = 'md', label = 'Loading…', className = '' }) {
  const sizeClass = size === 'sm' ? 'spinner-border-sm' : '';
  return (
    <span className={`spinner-border ${sizeClass} ${className}`} role="status">
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export function LoadingState({ label = 'Loading…', className = '' }) {
  return (
    <div className={`fa-state text-center py-5 ${className}`} role="status" aria-live="polite">
      <div className="spinner-border text-primary mb-3" aria-hidden="true" />
      <div className="text-muted small">{label}</div>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14, className = '', rounded = 6 }) {
  return (
    <span
      className={`fa-skeleton d-block ${className}`}
      style={{ width, height, borderRadius: rounded }}
      aria-hidden="true"
    />
  );
}

/** A few grey bars standing in for a list while it loads. */
export function SkeletonList({ rows = 4, className = '' }) {
  return (
    <div className={`d-flex flex-column gap-3 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="d-flex align-items-center gap-3">
          <Skeleton width={40} height={40} rounded={10} />
          <div className="flex-grow-1">
            <Skeleton width={`${60 + ((i * 13) % 30)}%`} height={12} className="mb-2" />
            <Skeleton width={`${30 + ((i * 7) % 25)}%`} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'bi-inbox', title, children, action, className = '', compact = false }) {
  return (
    <div className={`fa-state text-center ${compact ? 'py-4' : 'py-5'} ${className}`}>
      <div className="fa-state-icon mx-auto mb-3">
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      {title && <h3 className="h6 fw-semibold mb-1">{title}</h3>}
      {children && <div className="text-muted small mx-auto fa-state-text">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className = '', compact = false }) {
  return (
    <div className={`fa-state text-center ${compact ? 'py-4' : 'py-5'} ${className}`} role="alert">
      <div className="fa-state-icon fa-state-icon-danger mx-auto mb-3">
        <i className="bi bi-exclamation-triangle" aria-hidden="true" />
      </div>
      <h3 className="h6 fw-semibold mb-1">{title}</h3>
      {message && <div className="text-muted small mx-auto fa-state-text">{message}</div>}
      {onRetry && (
        <button type="button" className="btn btn-outline-primary btn-sm mt-3" onClick={onRetry}>
          <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
