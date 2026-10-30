import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import UploadsChart from '../components/charts/UploadsChart';
import CategoryDoughnut from '../components/charts/CategoryDoughnut';
import { EmptyState, ErrorState, Skeleton, SkeletonList } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  formatBytes,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  getFirstName,
  getGreeting,
  plural,
} from '../utils/format';
import { activityMeta, categoryColor, isDeletionAction } from '../utils/labels';

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function HeroBanner({ firstName, stats }) {
  const total = stats?.total_documents || 0;
  const pending = (stats?.awaiting_review || 0) + (stats?.failed || 0);
  const thisMonth = stats?.uploads_by_month?.find((m) => m.month === currentMonthKey());

  let sentence;
  if (!stats) {
    sentence = 'Loading your workspace…';
  } else if (total === 0 && pending === 0) {
    sentence = 'Welcome to FileAI! Upload your first document and let AI title, tag and file it for you.';
  } else {
    const lead = thisMonth?.uploaded
      ? `Your AI processed ${plural(thisMonth.uploaded, 'document')} this month`
      : `You have ${plural(total, 'document')} organised`;
    sentence = pending
      ? `${lead} — ${plural(pending, 'document')} ${pending === 1 ? 'needs' : 'need'} your review.`
      : `${lead} — everything is organised.`;
  }

  const quota = Number(stats?.storage_quota_bytes) || 0;
  const classifiedPct = total ? (stats?.ai_classified || 0) / total : null;

  return (
    <section className="fa-hero mb-4" aria-label="Summary">
      <div className="fa-hero-body">
        <div className="me-lg-4">
          <span className="fa-hero-pill">
            <span className="fa-live-dot" aria-hidden="true" /> AI active
          </span>
          <h2 className="fa-hero-title">
            {getGreeting()}, {firstName} <span aria-hidden="true">👋</span>
          </h2>
          <p className="fa-hero-text mb-0">{sentence}</p>
        </div>
        <div className="fa-hero-actions">
          <Link to="/search" className="btn fa-btn-ghost">
            <i className="bi bi-stars me-1" aria-hidden="true" />
            AI Search
          </Link>
          <Link to="/upload" className="btn btn-light fw-semibold">
            <i className="bi bi-cloud-arrow-up me-1" aria-hidden="true" />
            Upload Files
          </Link>
        </div>
      </div>
      <dl className="fa-hero-stats">
        <div>
          <dt>Total docs</dt>
          <dd>{stats ? formatNumber(total) : '—'}</dd>
        </div>
        <div>
          <dt>AI classified</dt>
          <dd>{classifiedPct === null ? '—' : formatPercent(classifiedPct)}</dd>
        </div>
        <div>
          <dt>Duplicates</dt>
          <dd>{stats ? formatNumber(stats.duplicates_found || 0) : '—'}</dd>
        </div>
        <div>
          <dt>Storage used</dt>
          <dd>
            {stats ? formatBytes(stats.storage_used_bytes || 0) : '—'}
            {quota > 0 && <span className="fa-hero-sub d-none d-sm-inline"> of {formatBytes(quota)}</span>}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function ActivityFeed({ items }) {
  if (!items.length) {
    return (
      <EmptyState icon="bi-activity" title="No activity yet" compact>
        Uploads, AI classifications and edits will appear here.
      </EmptyState>
    );
  }
  return (
    <ul className="list-unstyled mb-0 fa-activity">
      {items.slice(0, 8).map((item, index) => {
        const meta = activityMeta(item.action);
        const linkable = item.file_id && !isDeletionAction(item.action);
        return (
          <li key={`${item.action}-${item.file_id}-${item.at}-${index}`} className="fa-activity-item">
            <span className={`fa-icon-tile fa-icon-tile-sm fa-tone-${meta.tone}`} aria-hidden="true">
              <i className={`bi ${meta.icon}`} />
            </span>
            <div className="min-w-0 flex-grow-1">
              <div className="fw-semibold small">{meta.label}</div>
              {item.file_name &&
                (linkable ? (
                  <Link to={`/documents/${item.file_id}`} className="small text-truncate d-block fa-link-muted">
                    {item.file_name}
                  </Link>
                ) : (
                  <div className="small text-truncate text-muted">{item.file_name}</div>
                ))}
              {item.details && <div className="small text-muted text-truncate">{item.details}</div>}
              <div className="fa-activity-time">{formatRelativeTime(item.at)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CategoryBreakdown({ data }) {
  if (!data.length) {
    return (
      <EmptyState icon="bi-tags" title="No categories yet" compact>
        Categories appear once the AI has classified your documents.
      </EmptyState>
    );
  }
  const sorted = [...data].sort((a, b) => (b.count || 0) - (a.count || 0));
  return (
    <div className="row g-3 align-items-center">
      <div className="col-sm-5">
        <CategoryDoughnut data={sorted} />
      </div>
      <div className="col-sm-7">
        <ul className="list-unstyled mb-0 fa-category-list">
          {sorted.slice(0, 6).map((row) => (
            <li key={row.category || 'uncategorised'}>
              <Link
                to={row.category ? `/documents?category=${encodeURIComponent(row.category)}` : '/documents'}
                className="d-flex align-items-center gap-2 text-decoration-none"
              >
                <span className="fa-dot" style={{ background: categoryColor(row.category || 'Uncategorised') }} />
                <span className="flex-grow-1 text-body text-truncate">{row.category || 'Uncategorised'}</span>
                <span className="fw-semibold text-body">{formatNumber(row.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {sorted.length > 6 && (
          <Link to="/categories" className="small d-inline-block mt-2">
            View all {sorted.length} categories
          </Link>
        )}
      </div>
    </div>
  );
}

function GettingStarted() {
  const steps = [
    { icon: 'bi-cloud-arrow-up', title: 'Upload a document', text: 'PDF, Word, text or an image — drag it in.' },
    { icon: 'bi-cpu', title: 'Review AI suggestions', text: 'Check the title, keywords, category and folder.' },
    { icon: 'bi-search', title: 'Search naturally', text: 'Ask "find my database assignment" and FileAI finds it.' },
  ];
  return (
    <div className="card fa-card mb-4">
      <div className="card-body p-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
          <div>
            <h2 className="h5 fw-bold mb-1">Let&apos;s organise your first file</h2>
            <p className="text-muted mb-0 small">Three quick steps and your documents will start sorting themselves.</p>
          </div>
          <Link to="/upload" className="btn btn-primary fa-btn-gradient">
            <i className="bi bi-cloud-arrow-up me-1" aria-hidden="true" />
            Upload your first document
          </Link>
        </div>
        <ol className="row g-3 list-unstyled mb-0">
          {steps.map((step, index) => (
            <li key={step.title} className="col-md-4">
              <div className="fa-step h-100">
                <span className="fa-step-number">{index + 1}</span>
                <span className="fa-icon-tile fa-tone-teal mb-2" aria-hidden="true">
                  <i className={`bi ${step.icon}`} />
                </span>
                <div className="fw-semibold">{step.title}</div>
                <div className="small text-muted">{step.text}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function AttentionCard({ stats }) {
  const awaiting = stats?.awaiting_review || 0;
  const failed = stats?.failed || 0;
  if (!awaiting && !failed) return null;
  return (
    <div className="alert fa-attention d-flex flex-column flex-sm-row align-items-sm-center gap-3 mb-4" role="status">
      <span className="fa-icon-tile fa-tone-amber" aria-hidden="true">
        <i className="bi bi-hourglass-split" />
      </span>
      <div className="flex-grow-1">
        <div className="fw-semibold">
          {awaiting > 0 && `${plural(awaiting, 'document')} awaiting your review`}
          {awaiting > 0 && failed > 0 && ' · '}
          {failed > 0 && `${plural(failed, 'upload')} failed processing`}
        </div>
        <div className="small text-muted">Approve or edit the AI suggestions so they can be filed and searched.</div>
      </div>
      <Link to="/review" className="btn btn-warning btn-sm fw-semibold text-nowrap">
        Open review queue
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, loading, error, refresh } = useWorkspace();
  const firstName = getFirstName(user?.name, user?.email);
  const initialLoading = loading && !stats;

  if (!stats && error && !loading) {
    return (
      <div className="card fa-card">
        <ErrorState title="Couldn't load your dashboard" message={error.message} onRetry={refresh} />
      </div>
    );
  }

  const total = stats?.total_documents || 0;
  const quota = Number(stats?.storage_quota_bytes) || 0;
  const used = Number(stats?.storage_used_bytes) || 0;
  const thisMonth = stats?.uploads_by_month?.find((m) => m.month === currentMonthKey());
  const isEmpty = stats && total === 0;

  return (
    <div className="fa-page">
      <HeroBanner firstName={firstName} stats={stats} />
      <AttentionCard stats={stats} />

      <div className="row g-3 g-xl-4 mb-4">
        <div className="col-6 col-xl-3">
          <StatCard
            icon="bi-file-earmark-text"
            tone="teal"
            value={formatNumber(total)}
            label="Total documents"
            caption={thisMonth?.uploaded ? `+${formatNumber(thisMonth.uploaded)} this month` : 'Stored and organised'}
            loading={initialLoading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            icon="bi-cpu"
            tone="cyan"
            value={formatNumber(stats?.ai_classified || 0)}
            label="AI classified"
            pill={total ? formatPercent((stats?.ai_classified || 0) / total) : null}
            caption="Titled, tagged and filed by AI"
            loading={initialLoading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            icon="bi-files"
            tone="amber"
            value={formatNumber(stats?.duplicates_found || 0)}
            label="Duplicates found"
            caption="Exact and similar copies detected"
            loading={initialLoading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            icon="bi-hdd-stack"
            tone="purple"
            value={formatBytes(used)}
            label="Storage used"
            pill={quota ? formatPercent(used / quota) : null}
            caption={quota ? `of ${formatBytes(quota)} available` : 'No storage quota set'}
            loading={initialLoading}
          />
        </div>
      </div>

      {isEmpty && <GettingStarted />}

      <div className="row g-3 g-xl-4 mb-4">
        <div className="col-xl-8">
          <div className="card fa-card h-100">
            <div className="card-header fa-card-header">
              <div>
                <h2 className="fa-card-title">Upload activity</h2>
                <div className="fa-card-subtitle">Uploads vs AI classified, by month</div>
              </div>
              <div className="d-flex gap-3 small">
                <span className="d-flex align-items-center gap-1">
                  <span className="fa-dot" style={{ background: '#0f766e' }} /> Uploaded
                </span>
                <span className="d-flex align-items-center gap-1">
                  <span className="fa-dot" style={{ background: '#06b6d4' }} /> AI classified
                </span>
              </div>
            </div>
            <div className="card-body">
              {initialLoading && <Skeleton height={260} rounded={12} />}
              {!initialLoading &&
                (stats?.uploads_by_month?.length ? (
                  <UploadsChart data={stats.uploads_by_month} />
                ) : (
                  <EmptyState icon="bi-graph-up" title="No upload history yet">
                    Your monthly upload trend will appear here after your first upload.
                  </EmptyState>
                ))}
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card fa-card h-100">
            <div className="card-header fa-card-header">
              <h2 className="fa-card-title">AI Activity</h2>
              <span className="fa-live-pill">
                <span className="fa-live-dot" aria-hidden="true" /> Live
              </span>
            </div>
            <div className="card-body fa-activity-body">
              {initialLoading ? <SkeletonList rows={5} /> : <ActivityFeed items={stats?.recent_activity || []} />}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 g-xl-4">
        <div className="col-lg-7">
          <div className="card fa-card h-100">
            <div className="card-header fa-card-header">
              <div>
                <h2 className="fa-card-title">Documents by category</h2>
                <div className="fa-card-subtitle">How the AI has classified your files</div>
              </div>
              <Link to="/categories" className="small">
                All categories
              </Link>
            </div>
            <div className="card-body">
              {initialLoading ? <SkeletonList rows={4} /> : <CategoryBreakdown data={stats?.by_category || []} />}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card fa-card h-100">
            <div className="card-header fa-card-header">
              <h2 className="fa-card-title">Quick actions</h2>
            </div>
            <div className="card-body d-grid gap-2">
              <Link to="/upload" className="fa-quick-action">
                <span className="fa-icon-tile fa-tone-teal" aria-hidden="true">
                  <i className="bi bi-cloud-arrow-up" />
                </span>
                <span>
                  <span className="fw-semibold d-block">Upload files</span>
                  <span className="small text-muted">Drag &amp; drop PDFs, Word docs, text or images</span>
                </span>
                <i className="bi bi-chevron-right ms-auto text-muted" aria-hidden="true" />
              </Link>
              <Link to="/search" className="fa-quick-action">
                <span className="fa-icon-tile fa-tone-cyan" aria-hidden="true">
                  <i className="bi bi-stars" />
                </span>
                <span>
                  <span className="fw-semibold d-block">AI search</span>
                  <span className="small text-muted">Find documents by describing them</span>
                </span>
                <i className="bi bi-chevron-right ms-auto text-muted" aria-hidden="true" />
              </Link>
              <Link to="/folders" className="fa-quick-action">
                <span className="fa-icon-tile fa-tone-amber" aria-hidden="true">
                  <i className="bi bi-folder2-open" />
                </span>
                <span>
                  <span className="fw-semibold d-block">Browse folders</span>
                  <span className="small text-muted">See how your files are organised</span>
                </span>
                <i className="bi bi-chevron-right ms-auto text-muted" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
