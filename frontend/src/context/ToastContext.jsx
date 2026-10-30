// Tiny toast system built on Bootstrap's .toast styles (no Bootstrap JS needed).
// Usage: const toast = useToast(); toast.success('Saved'); toast.error('Failed');
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = {
  success: 'bi-check-circle-fill',
  danger: 'bi-exclamation-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
};

const MAX_VISIBLE = 4;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message, { variant = 'info', title, duration = 4500 } = {}) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, message, variant, title }]);
      if (duration) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) => show(message, { ...options, variant: 'success' }),
      error: (message, options) => show(message, { duration: 7000, ...options, variant: 'danger' }),
      warning: (message, options) => show(message, { duration: 6000, ...options, variant: 'warning' }),
      info: (message, options) => show(message, { ...options, variant: 'info' }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3 fa-toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast show fa-toast fa-toast-${toast.variant}`}
            role={toast.variant === 'danger' ? 'alert' : 'status'}
            aria-atomic="true"
          >
            <div className="d-flex align-items-start gap-2 p-3">
              <i className={`bi ${ICONS[toast.variant] || ICONS.info} fa-toast-icon`} aria-hidden="true" />
              <div className="flex-grow-1 small">
                {toast.title && <div className="fw-semibold mb-1">{toast.title}</div>}
                <div>{toast.message}</div>
              </div>
              <button
                type="button"
                className="btn-close btn-close-sm ms-2"
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
