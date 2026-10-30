import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import PasswordInput from '../components/PasswordInput';
import PasswordChecklist from '../components/PasswordChecklist';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getApiError } from '../api/client';
import { validateRegistration } from '../utils/validation';
import useDocumentTitle from '../hooks/useDocumentTitle';

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' };

// API field names -> form field names
const FIELD_MAP = { name: 'firstName', email: 'email', password: 'password' };

export default function RegisterPage() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // After the first submit attempt, errors update live as the user types.
  const clientErrors = submitted ? validateRegistration(form) : {};
  const errors = { ...clientErrors, ...serverErrors };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (serverErrors[name]) setServerErrors((e) => ({ ...e, [name]: undefined }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setApiError('');
    setServerErrors({});
    const validation = validateRegistration(form);
    const firstInvalid = Object.keys(EMPTY_FORM).find((key) => validation[key]);
    if (firstInvalid) {
      document.getElementById(`register-${firstInvalid}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const email = form.email.trim();
      await register({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email,
        password: form.password,
      });
      toast.success('Account created. Please sign in.');
      navigate('/login', { replace: true, state: { registered: true, email } });
    } catch (err) {
      const error = getApiError(err);
      if (error.code === 'EMAIL_EXISTS' || error.status === 409) {
        setServerErrors({ email: error.details?.message || 'An account with this email already exists.' });
        document.getElementById('register-email')?.focus();
      } else if (Object.keys(error.fields).length) {
        const mapped = {};
        Object.entries(error.fields).forEach(([field, message]) => {
          mapped[FIELD_MAP[field] || field] = message;
        });
        setServerErrors(mapped);
        setApiError(error.message);
      } else {
        setApiError(error.message);
      }
      setSubmitting(false);
    }
  };

  const confirmMatches = form.confirmPassword && form.confirmPassword === form.password;

  const field = (name, label, props = {}) => (
    <div className={props.wrapperClass || 'mb-3'}>
      <label htmlFor={`register-${name}`} className="form-label">
        {label}
      </label>
      <input
        id={`register-${name}`}
        name={name}
        className={`form-control ${errors[name] ? 'is-invalid' : ''}`}
        value={form[name]}
        onChange={handleChange}
        aria-invalid={Boolean(errors[name]) || undefined}
        aria-describedby={errors[name] ? `register-${name}-error` : undefined}
        type={props.type || 'text'}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        autoFocus={props.autoFocus}
      />
      {errors[name] && (
        <div id={`register-${name}-error`} className="invalid-feedback">
          {errors[name]}
        </div>
      )}
    </div>
  );

  return (
    <AuthShell title="Create your account" subtitle="Start organising with AI — it takes 30 seconds">
      {apiError && (
        <div className="alert alert-danger d-flex gap-2 small" role="alert">
          <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
          <span>{apiError}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
        <div className="row g-3 mb-3">
          {field('firstName', 'First name', {
            wrapperClass: 'col-sm-6',
            placeholder: 'Alex',
            autoComplete: 'given-name',
            autoFocus: true,
          })}
          {field('lastName', 'Last name', { wrapperClass: 'col-sm-6', placeholder: 'Chen', autoComplete: 'family-name' })}
        </div>
        {field('email', 'Email address', { type: 'email', placeholder: 'you@university.edu', autoComplete: 'email' })}

        <div className="mb-3">
          <label htmlFor="register-password" className="form-label">
            Password
          </label>
          <PasswordInput
            id="register-password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a strong password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            describedBy="register-password-rules"
          />
          {errors.password && <div className="invalid-feedback d-block">{errors.password}</div>}
          <PasswordChecklist password={form.password} id="register-password-rules" />
        </div>

        <div className="mb-4">
          <label htmlFor="register-confirmPassword" className="form-label">
            Confirm password
          </label>
          <PasswordInput
            id="register-confirmPassword"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Repeat your password"
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
            describedBy="register-confirm-help"
          />
          <div id="register-confirm-help" aria-live="polite">
            {errors.confirmPassword ? (
              <div className="invalid-feedback d-block">{errors.confirmPassword}</div>
            ) : (
              form.confirmPassword && (
                <div className={`small mt-1 ${confirmMatches ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi ${confirmMatches ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`} aria-hidden="true" />
                  {confirmMatches ? 'Passwords match' : 'Passwords do not match'}
                </div>
              )
            )}
          </div>
        </div>

        <button type="submit" className="btn btn-primary fa-btn-gradient w-100 py-2" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
      <p className="text-center small mt-4 mb-0">
        Already have an account?{' '}
        <Link to="/login" className="fw-semibold">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
