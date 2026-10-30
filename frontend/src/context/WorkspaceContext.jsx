// Workspace summary (GET /api/dashboard/stats) shared by the sidebar (review
// badge, storage widget) and the dashboard. Refreshed on every navigation and
// whenever a page calls refresh() after changing documents.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getDashboardStats } from '../api/dashboard';
import { getApiError } from '../api/client';

const WorkspaceContext = createContext({
  stats: null,
  loading: false,
  error: null,
  refresh: () => Promise.resolve(),
});

export function WorkspaceProvider({ children }) {
  const [state, setState] = useState({ stats: null, loading: true, error: null });
  const inFlight = useRef(null);
  const mounted = useRef(true);
  const { pathname } = useLocation();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    setState((s) => ({ ...s, loading: true }));
    inFlight.current = getDashboardStats()
      .then((stats) => {
        if (mounted.current) setState({ stats, loading: false, error: null });
        return stats;
      })
      .catch((err) => {
        if (mounted.current) setState((s) => ({ ...s, loading: false, error: getApiError(err) }));
        return null;
      })
      .finally(() => {
        inFlight.current = null;
      });
    return inFlight.current;
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
