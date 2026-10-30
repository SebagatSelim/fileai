import { Skeleton } from './Feedback';

/** Dashboard KPI card with coloured top accent, icon tile, value and caption. */
export default function StatCard({ icon, tone = 'teal', value, label, caption, pill, loading = false }) {
  return (
    <div className={`card fa-card fa-stat-card fa-accent-${tone} h-100`}>
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between mb-3">
          <span className={`fa-icon-tile fa-tone-${tone}`} aria-hidden="true">
            <i className={`bi ${icon}`} />
          </span>
          {pill && !loading && <span className={`fa-stat-pill fa-tone-${tone}`}>{pill}</span>}
        </div>
        {loading ? (
          <>
            <Skeleton width="45%" height={26} className="mb-2" />
            <Skeleton width="70%" height={12} />
          </>
        ) : (
          <>
            <div className="fa-stat-value">{value}</div>
            <div className="fa-stat-label">{label}</div>
            {caption && <div className="fa-stat-caption">{caption}</div>}
          </>
        )}
      </div>
    </div>
  );
}
