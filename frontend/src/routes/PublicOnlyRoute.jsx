import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Where to go after signing in: the page the user originally asked for, or the dashboard. */
export function getRedirectTarget(state) {
  const from = state?.from;
  if (from && typeof from === 'object' && from.pathname && from.pathname !== '/login') {
    return `${from.pathname}${from.search || ''}${from.hash || ''}`;
  }
  return '/';
}

/** Login / register pages: signed-in users are sent on to the app. */
export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (isAuthenticated) return <Navigate to={getRedirectTarget(location.state)} replace />;
  return children ?? <Outlet />;
}
