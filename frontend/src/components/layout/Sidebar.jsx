import { Link, NavLink, useLocation } from 'react-router-dom';
import BrandLogo from '../BrandLogo';
import StorageWidget from '../StorageWidget';
import { useWorkspace } from '../../context/WorkspaceContext';
import useSignOut from '../../hooks/useSignOut';

const REVIEW_ROUTE = /^\/documents\/[^/]+\/review\/?$/;

/** `active` (optional boolean) overrides NavLink's own prefix matching. */
function NavItem({ to, icon, label, badge, end = false, onNavigate, active }) {
  const content = (
    <>
      <span className="fa-nav-icon" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <span className="flex-grow-1">{label}</span>
      {badge > 0 && (
        <span className="fa-nav-badge" title={`${badge} documents need attention`}>
          {badge > 99 ? '99+' : badge}
          <span className="visually-hidden"> documents need attention</span>
        </span>
      )}
    </>
  );
  if (active !== undefined) {
    return (
      <Link
        to={to}
        className={`fa-nav-link ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        {content}
      </Link>
    );
  }
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `fa-nav-link ${isActive ? 'active' : ''}`}
      onClick={onNavigate}
    >
      {content}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { stats, loading } = useWorkspace();
  const signOut = useSignOut();
  const { pathname } = useLocation();
  // The per-document review page belongs to the Review Queue section, not Documents.
  const onReviewPage = REVIEW_ROUTE.test(pathname);
  // Review queue = documents awaiting review + documents whose processing failed.
  const reviewCount = (stats?.awaiting_review || 0) + (stats?.failed || 0);

  return (
    <aside id="fa-sidebar" className={`fa-sidebar ${open ? 'show' : ''}`} aria-label="Main navigation">
      <div className="fa-sidebar-header">
        <Link to="/" className="text-decoration-none" onClick={onClose} aria-label="FileAI dashboard">
          <BrandLogo size={38} />
        </Link>
        <button type="button" className="btn fa-sidebar-close d-lg-none" onClick={onClose} aria-label="Close menu">
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      <nav className="fa-sidebar-nav">
        <div className="fa-nav-section">Main menu</div>
        <NavItem to="/" end icon="bi-grid-1x2" label="Dashboard" onNavigate={onClose} />
        <NavItem
          to="/documents"
          icon="bi-file-earmark-text"
          label="Documents"
          onNavigate={onClose}
          active={onReviewPage ? false : undefined}
        />
        <NavItem to="/upload" icon="bi-cloud-arrow-up" label="Upload Files" onNavigate={onClose} />
        <NavItem to="/search" icon="bi-search" label="AI Search" onNavigate={onClose} />
        <NavItem
          to="/review"
          icon="bi-cpu"
          label="Review Queue"
          badge={reviewCount}
          onNavigate={onClose}
          active={onReviewPage ? true : undefined}
        />

        <div className="fa-nav-section">Organize</div>
        <NavItem to="/folders" icon="bi-folder2" label="All Folders" onNavigate={onClose} />
        <NavItem to="/categories" icon="bi-tags" label="Categories" onNavigate={onClose} />
      </nav>

      <div className="fa-sidebar-footer">
        <NavItem to="/settings" icon="bi-person-gear" label="Profile & Settings" onNavigate={onClose} />
        <button type="button" className="fa-nav-link w-100" onClick={signOut}>
          <span className="fa-nav-icon" aria-hidden="true">
            <i className="bi bi-box-arrow-right" />
          </span>
          <span className="flex-grow-1 text-start">Sign out</span>
        </button>
        <div className="mt-3">
          <StorageWidget
            variant="dark"
            usedBytes={stats?.storage_used_bytes}
            quotaBytes={stats?.storage_quota_bytes}
            loading={loading && !stats}
          />
        </div>
      </div>
    </aside>
  );
}
