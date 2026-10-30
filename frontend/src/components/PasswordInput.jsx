import { useState } from 'react';

/** Masked password field with a show/hide toggle. */
export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder = 'Enter your password',
  autoComplete = 'current-password',
  invalid = false,
  describedBy,
  disabled = false,
  name,
  onBlur,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="fa-password-input position-relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        className={`form-control pe-5 ${invalid ? 'is-invalid' : ''}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
      />
      <button
        type="button"
        className="btn fa-password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={id}
        tabIndex={0}
        disabled={disabled}
      >
        <i className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
      </button>
    </div>
  );
}
