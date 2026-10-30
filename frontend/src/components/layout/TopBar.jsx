import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import UserMenu from './UserMenu';

export default function TopBar({ title, onMenuClick }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [lastPath, setLastPath] = useState(pathname);

  // Clear the quick-search box after navigating to another page.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (pathname !== '/search') setQuery('');
  }

  // Press "/" anywhere (outside a form field) to jump to quick search.
  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable;
      if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
    inputRef.current?.blur();
  };

  return (
    <header className="fa-topbar">
      <button
        type="button"
        className="btn fa-icon-button d-lg-none"
        onClick={onMenuClick}
        aria-label="Open menu"
        aria-controls="fa-sidebar"
      >
        <i className="bi bi-list" aria-hidden="true" />
      </button>
      <h1 className="fa-topbar-title text-truncate">{title}</h1>

      <div className="ms-auto d-flex align-items-center gap-2 gap-md-3">
        <form className="fa-quick-search d-none d-md-flex" role="search" onSubmit={submit}>
          <i className="bi bi-search" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quick search…"
            aria-label="Quick search your documents"
          />
          <kbd title="Press / to search">/</kbd>
        </form>
        <Link to="/search" className="btn fa-icon-button d-md-none" aria-label="Search">
          <i className="bi bi-search" aria-hidden="true" />
        </Link>
        <Link to="/upload" className="btn btn-primary btn-sm fa-btn-gradient d-flex align-items-center gap-1">
          <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
          <span className="d-none d-sm-inline">Upload</span>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
