import { formatBytes } from '../utils/format';

/** Storage used vs quota bar. `variant="dark"` is the sidebar version. */
export default function StorageWidget({ usedBytes, quotaBytes, variant = 'light', loading = false }) {
  const hasQuota = Number(quotaBytes) > 0;
  const percent = hasQuota ? Math.min(100, (Number(usedBytes || 0) / Number(quotaBytes)) * 100) : 0;
  const tone = percent >= 90 ? 'danger' : percent >= 75 ? 'warning' : 'ok';

  return (
    <div className={`fa-storage fa-storage-${variant}`}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="d-flex align-items-center gap-2 fw-semibold small">
          <i className="bi bi-hdd-stack" aria-hidden="true" />
          Storage
        </span>
        {hasQuota && !loading && <span className="fa-storage-pill">{Math.round(percent)}%</span>}
      </div>
      <div
        className="progress fa-storage-bar"
        role="progressbar"
        aria-label="Storage used"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`progress-bar fa-storage-fill-${tone}`} style={{ width: `${loading ? 0 : percent}%` }} />
      </div>
      <div className="d-flex justify-content-between mt-2 fa-storage-caption">
        <span>{loading && usedBytes == null ? '…' : `${formatBytes(usedBytes || 0)} used`}</span>
        <span>{hasQuota ? `${formatBytes(quotaBytes)} total` : 'No quota set'}</span>
      </div>
    </div>
  );
}
