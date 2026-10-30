import Modal from './Modal';

/** Yes/no confirmation dialog for destructive actions (delete, discard). */
export default function ConfirmModal({
  show,
  title = 'Are you sure?',
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  icon = 'bi-exclamation-triangle',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      show={show}
      title={title}
      onClose={onCancel}
      icon={icon}
      iconTone={variant === 'danger' ? 'red' : 'teal'}
      closeDisabled={busy}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn btn-${variant}`}
            onClick={onConfirm}
            disabled={busy}
            data-autofocus
          >
            {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-body-secondary">{children}</div>
    </Modal>
  );
}
