import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/** Signs out (POST /api/auth/logout), clears the session and returns to /login. */
export default function useSignOut() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  return useCallback(async () => {
    await logout();
    navigate('/login', { replace: true, state: { signedOut: true } });
    toast.info('You have been signed out.');
  }, [logout, navigate, toast]);
}
