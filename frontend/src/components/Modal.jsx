// Accessible modal built on Bootstrap's modal markup, controlled by React state
// (no Bootstrap JS). Closes on Escape and backdrop click.
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({
  show,
  title,
  onClose,
  children,
  footer,
  size,
  icon,
  iconTone = 'teal',
  closeDisabled = false,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);
  // Keep the latest callbacks in refs so the open/close effect only depends on `show`.
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  });

  useEffect(() => {
    if (!show) return undefined;
    previouslyFocused.current = document.activeElement;
    document.body.classList.add('modal-open');
    const onKey = (event) => {
      if (event.key === 'Escape' && !closeDisabledRef.current) onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    // Focus the first form control (or an element marked data-autofocus).
    const timer = window.setTimeout(() => {
      const focusable = dialogRef.current?.querySelector(
        '[data-autofocus], input:not([type=hidden]):not([disabled]), textarea, select',
      );
      (focusable || dialogRef.current)?.focus();
    }, 20);
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
      const previous = previouslyFocused.current;
      if (previous && document.contains(previous)) previous.focus?.();
    };
  }, [show]);

  if (!show) return null;

  return createPortal(
    <>
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !closeDisabled) onClose?.();
        }}
      >
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size ? `modal-${size}` : ''}`}>
          <div className="modal-content fa-modal" ref={dialogRef} tabIndex={-1}>
            <div className="modal-header border-0 pb-0">
              <div className="d-flex align-items-center gap-2">
                {icon && (
                  <span className={`fa-icon-tile fa-tone-${iconTone}`} aria-hidden="true">
                    <i className={`bi ${icon}`} />
                  </span>
                )}
                <h2 className="modal-title h5 mb-0" id={titleId}>
                  {title}
                </h2>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={closeDisabled}
              />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer border-0 pt-0">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>,
    document.body,
  );
}
