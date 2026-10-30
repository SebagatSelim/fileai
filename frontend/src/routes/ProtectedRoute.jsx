import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Renders the child routes only for signed-in users; otherwise redirects to
 * /login. After a 401 / token timeout the login page shows "session expired"
 * and returns the user to the page they were on once they sign in again.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, endReason } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const state =
      endReason === 'signedOut'
        ? { signedOut: true }
        : { from: location, sessionExpired: endReason === 'expired' };
    return <Navigate to="/login" replace state={state} />;
  }
  return children ?? <Outlet />;
}
