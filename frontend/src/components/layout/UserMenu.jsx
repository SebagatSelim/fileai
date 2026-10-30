import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useClickOutside from '../../hooks/useClickOutside';
import useSignOut from '../../hooks/useSignOut';
import { getInitials } from '../../utils/format';

export default function UserMenu() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div className="dropdown fa-user-menu" ref={ref}>
      <button
        type="button"
        className="btn d-flex align-items-center gap-2 px-1 fa-user-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="fa-avatar" aria-hidden="true">
          {getInitials(user?.name, user?.email)}
        </span>
        <span className="d-none d-md-flex flex-column align-items-start lh-sm text-start">
          <span className="fw-semibold small text-truncate fa-user-name">{user?.name || 'Your account'}</span>
          <span className="text-muted fa-user-email text-truncate">{user?.email}</span>
        </span>
        <i className="bi bi-chevron-down small text-muted d-none d-md-inline" aria-hidden="true" />
      </button>
      {open && (
        <div className="dropdown-menu dropdown-menu-end show fa-dropdown" role="menu">
          <div className="px-3 py-2 border-bottom mb-1">
            <div className="fw-semibold small text-truncate">{user?.name}</div>
            <div className="text-muted small text-truncate">{user?.email}</div>
          </div>
          <Link to="/settings" className="dropdown-item" role="menuitem" onClick={close}>
            <i className="bi bi-person-gear me-2" aria-hidden="true" />
            Profile &amp; Settings
          </Link>
          <Link to="/review" className="dropdown-item" role="menuitem" onClick={close}>
            <i className="bi bi-cpu me-2" aria-hidden="true" />
            Review queue
          </Link>
          <div className="dropdown-divider" />
          <button
            type="button"
            className="dropdown-item text-danger"
            role="menuitem"
            onClick={() => {
              close();
              signOut();
            }}
          >
            <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
