// Holds the signed-in user and JWT. The token lives in sessionStorage
// (key "fileai_token") so it is cleared when the browser tab closes.
//
// When a session ends, `endReason` records why ('expired' after a 401 or token
// timeout, 'signedOut' after Sign out). ProtectedRoute uses it to redirect to
// /login with the right message, so there is exactly one redirect.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';
import {
  clearSession,
  getStoredUser,
  getToken,
  getTokenExpiry,
  isSessionExpired,
  saveSession,
  saveUser,
  setUnauthorizedHandler,
} from '../api/client';

const AuthContext = createContext(null);

function readInitialState() {
  if (isSessionExpired()) {
    clearSession();
    return { session: { token: null, user: null }, reason: 'expired' };
  }
  return { session: { token: getToken(), user: getStoredUser() }, reason: null };
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function AuthProvider({ children }) {
  const [initial] = useState(readInitialState);
  const [session, setSession] = useState(initial.session);
  const [endReason, setEndReason] = useState(initial.reason);

  // Called on any 401 from a protected request, or when the token expires.
  // Safe to call several times (parallel requests can all fail with 401).
  const expireSession = useCallback(() => {
    clearSession();
    setEndReason('expired');
    setSession((current) => (current.token ? { token: null, user: null } : current));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(expireSession);
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  // Log out automatically when the JWT's lifetime (expires_in) runs out.
  useEffect(() => {
    if (!session.token) return undefined;
    const expiry = getTokenExpiry();
    if (!expiry) return undefined;
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      expireSession();
      return undefined;
    }
    const timer = window.setTimeout(expireSession, Math.min(remaining, MAX_TIMEOUT_MS));
    return () => window.clearTimeout(timer);
  }, [session.token, expireSession]);

  // Refresh the stored user (and validate the token) once per session start.
  useEffect(() => {
    if (!session.token) return undefined;
    let cancelled = false;
    authApi
      .getMe()
      .then((me) => {
        if (cancelled || !me) return;
        setSession((current) => {
          if (!current.token) return current;
          const user = { ...(current.user || {}), ...me };
          saveUser(user);
          return { ...current, user };
        });
      })
      .catch(() => {
        // 401 is handled by the interceptor; other errors are non-fatal here.
      });
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email: email.trim(), password });
    saveSession({ token: data.access_token, user: data.user, expiresIn: data.expires_in });
    setEndReason(null);
    setSession({ token: data.access_token, user: data.user });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The token may already be invalid; signing out locally is what matters.
    }
    clearSession();
    setEndReason('signedOut');
    setSession({ token: null, user: null });
  }, []);

  const register = useCallback((payload) => authApi.register(payload), []);

  const updateUser = useCallback((changes) => {
    setSession((current) => {
      const user = { ...(current.user || {}), ...changes };
      saveUser(user);
      return { ...current, user };
    });
  }, []);

  const value = useMemo(
    () => ({
      user: session.user,
      token: session.token,
      isAuthenticated: Boolean(session.token),
      endReason,
      login,
      logout,
      register,
      updateUser,
    }),
    [session, endReason, login, logout, register, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
