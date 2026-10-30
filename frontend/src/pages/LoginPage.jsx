import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getApiError } from '../api/client';
import { getRedirectTarget } from '../routes/PublicOnlyRoute';
import { validateLogin } from '../utils/validation';
import { getFirstName } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const [form, setForm] = useState({ email: state.email || '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setApiError('');
    const validation = validateLogin(form);
    setErrors(validation);
    if (validation.email) {
      emailRef.current?.focus();
      return;
    }
    if (validation.password) {
      passwordRef.current?.querySelector('input')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${getFirstName(user?.name, user?.email)}!`);
      navigate(getRedirectTarget(state), { replace: true });
    } catch (err) {
      const error = getApiError(err);
      // Show the API's message; the server uses the same 401 for unknown email and wrong password.
      const message =
        error.details?.message || (error.status === 401 ? 'Incorrect email or password.' : error.message);
      setApiError(message);
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your FileAI account"
      footer={null}
    >
      {state.registered && (
        <div className="alert alert-success d-flex gap-2 small" role="status">
          <i className="bi bi-check-circle-fill" aria-hidden="true" />
          <span>Your account has been created. Sign in to get started.</span>
        </div>
      )}
      {state.sessionExpired && !state.registered && (
        <div className="alert alert-warning d-flex gap-2 small" role="status">
          <i className="bi bi-clock-history" aria-hidden="true" />
          <span>Your session has expired. Please sign in again.</span>
        </div>
      )}
      {apiError && (
        <div className="alert alert-danger d-flex gap-2 small" role="alert">
          <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Sign in form">
        <div className="mb-3">
          <label htmlFor="login-email" className="form-label">
            Email address
          </label>
          <input
            ref={emailRef}
            id="login-email"
            name="email"
            type="email"
            className={`form-control ${errors.email ? 'is-invalid' : ''}`}
            value={form.email}
            onChange={handleChange}
            placeholder="you@university.edu"
            autoComplete="email"
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            autoFocus
          />
          {errors.email && (
            <div id="login-email-error" className="invalid-feedback">
              {errors.email}
            </div>
          )}
        </div>

        <div className="mb-4" ref={passwordRef}>
          <label htmlFor="login-password" className="form-label">
            Password
          </label>
          <PasswordInput
            id="login-password"
            name="password"
            value={form.password}
            onChange={handleChange}
            invalid={Boolean(errors.password)}
            describedBy={errors.password ? 'login-password-error' : undefined}
          />
          {errors.password && (
            <div id="login-password-error" className="invalid-feedback d-block">
              {errors.password}
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary fa-btn-gradient w-100 py-2" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            'Sign in to FileAI'
          )}
        </button>
      </form>

      <p className="text-center small mt-4 mb-0">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="fw-semibold">
          Create account
        </Link>
      </p>
    </AuthShell>
  );
}
