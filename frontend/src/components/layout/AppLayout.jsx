import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { getPageTitle } from './pageTitles';
import { LoadingState } from '../Feedback';
import { WorkspaceProvider } from '../../context/WorkspaceContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/** Signed-in shell: dark sidebar (off-canvas below lg) + top bar + page content. */
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);
  useDocumentTitle(title);

  // Escape closes the off-canvas menu on small screens.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  return (
    <WorkspaceProvider>
      <a href="#main-content" className="visually-hidden-focusable fa-skip-link">
        Skip to content
      </a>
      <div className="fa-app">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <div className="fa-sidebar-backdrop d-lg-none" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        <div className="fa-main">
          <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
          <main className="fa-content" id="main-content" tabIndex={-1}>
            <Suspense fallback={<LoadingState label="Loading page…" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
