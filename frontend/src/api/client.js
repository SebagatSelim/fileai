// Shared Axios instance for the Flask API.
//
// - Base URL is relative ("/api"); in development Vite proxies it to Flask.
// - The JWT from sessionStorage is attached as `Authorization: Bearer <token>`.
// - Any 401 from a protected call clears the session and sends the user to
//   /login (see setUnauthorizedHandler, wired up by AuthContext).
import axios from 'axios';

export const TOKEN_KEY = 'fileai_token';
export const USER_KEY = 'fileai_user';
export const EXPIRES_KEY = 'fileai_token_expires_at';

const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
  timeout: 120000,
});

// ---------- session storage helpers ----------

function safeStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  return safeStorage()?.getItem(TOKEN_KEY) || null;
}

export function getStoredUser() {
  const raw = safeStorage()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getTokenExpiry() {
  const raw = safeStorage()?.getItem(EXPIRES_KEY);
  const value = raw ? Number(raw) : null;
  return Number.isFinite(value) ? value : null;
}

export function saveSession({ token, user, expiresIn }) {
  const store = safeStorage();
  if (!store) return;
  if (token) store.setItem(TOKEN_KEY, token);
  if (user) store.setItem(USER_KEY, JSON.stringify(user));
  if (expiresIn) store.setItem(EXPIRES_KEY, String(Date.now() + Number(expiresIn) * 1000));
}

export function saveUser(user) {
  safeStorage()?.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  const store = safeStorage();
  if (!store) return;
  store.removeItem(TOKEN_KEY);
  store.removeItem(USER_KEY);
  store.removeItem(EXPIRES_KEY);
}

export function isSessionExpired(now = Date.now()) {
  const expiry = getTokenExpiry();
  return Boolean(expiry && now >= expiry);
}

// ---------- 401 handling ----------

let unauthorizedHandler = null;

/** AuthContext registers a handler that resets state and navigates to /login. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !config.skipAuth) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    // Remember that this request was authenticated so a 401 means "session ended".
    config.sentWithToken = true;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const config = error?.config || {};
    if (status === 401 && config.sentWithToken && !config.skipAuthRedirect) {
      clearSession();
      if (unauthorizedHandler) unauthorizedHandler();
      else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

// ---------- error normalisation ----------

const DEFAULT_MESSAGES = {
  400: 'Some of the information is not valid. Please check and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: 'That conflicts with something that already exists.',
  413: 'The file is too large to upload.',
  422: 'The document could not be processed.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again.',
  502: 'The server is unavailable right now. Please try again shortly.',
  503: 'The server is unavailable right now. Please try again shortly.',
  504: 'The server took too long to respond. Please try again.',
};

/**
 * Normalise any thrown value into
 * { status, code, message, fields, details } where `details` is the raw
 * `error` object from the API (useful for extras such as existing_file).
 */
export function getApiError(error, fallbackMessage = 'Something went wrong. Please try again.') {
  if (axios.isCancel?.(error) || error?.code === 'ERR_CANCELED') {
    return { status: 0, code: 'CANCELLED', message: 'Request cancelled.', fields: {}, details: {} };
  }
  const response = error?.response;
  if (!response) {
    const timedOut = error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT';
    return {
      status: 0,
      code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: timedOut
        ? 'The request timed out. Please try again.'
        : "Can't reach the FileAI server. Check your connection and that the backend is running.",
      fields: {},
      details: {},
    };
  }
  const body = response.data && typeof response.data === 'object' ? response.data : {};
  const apiError = body.error && typeof body.error === 'object' ? body.error : {};
  return {
    status: response.status,
    code: apiError.code || `HTTP_${response.status}`,
    message: apiError.message || DEFAULT_MESSAGES[response.status] || fallbackMessage,
    fields: apiError.fields && typeof apiError.fields === 'object' ? apiError.fields : {},
    details: apiError,
  };
}

export default api;
