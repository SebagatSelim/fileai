import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PasswordChecklist from '../components/PasswordChecklist';
import PasswordInput from '../components/PasswordInput';
import StorageWidget from '../components/StorageWidget';
import { ErrorState, Skeleton } from '../components/Feedback';
import { changePassword, getProfile, updateProfile } from '../api/users';
import { getApiError } from '../api/client';
import { useAppConfig } from '../context/AppConfigContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useSignOut from '../hooks/useSignOut';
import { formatBytes, formatDate, formatNumber, formatPercent, getInitials } from '../utils/format';
import { describeExtensions } from '../utils/fileTypes';
import { isValidEmail, validatePasswordChange } from '../utils/validation';

const TABS = [
  { id: 'profile', label: 'Personal', icon: 'bi-person' },
  { id: 'security', label: 'Security', icon: 'bi-shield-lock' },
  { id: 'storage', label: 'Storage', icon: 'bi-hdd-stack' },
  { id: 'ai', label: 'AI & Privacy', icon: 'bi-cpu' },
];

const PROVIDER_LABELS = {
  local: 'Local model (runs on the FileAI server)',
  openai: 'OpenAI API',
  huggingface: 'Hugging Face model',
};

const STORAGE_LABELS = { local: 'Local disk on the server', s3: 'Amazon S3 (encrypted cloud storage)' };

function ProfileForm({ profile, onSaved }) {
  const toast = useToast();
  const initial = { name: profile?.name || '', email: profile?.email || '' };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = form.name.trim() !== initial.name || form.email.trim() !== initial.email;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    const validation = {};
    if (!form.name.trim()) validation.name = 'Name is required.';
    if (!form.email.trim()) validation.email = 'Email is required.';
    else if (!isValidEmail(form.email)) validation.email = 'Enter a valid email address.';
    setErrors(validation);
    if (Object.keys(validation).length) return;

    const changes = {};
    if (form.name.trim() !== initial.name) changes.name = form.name.trim();
    if (form.email.trim() !== initial.email) changes.email = form.email.trim();
    if (!Object.keys(changes).length) return;

    setSaving(true);
    try {
      const updated = await updateProfile(changes);
      onSaved({ ...changes, ...(updated || {}) });
      toast.success('Profile updated.');
    } catch (err) {
      const apiError = getApiError(err);
      if (apiError.code === 'EMAIL_EXISTS' || apiError.status === 409) {
        setErrors({ email: apiError.details.message || 'That email is already used by another account.' });
      } else {
        setErrors(apiError.fields || {});
        setFormError(apiError.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h2 className="h6 fw-bold mb-3">Personal information</h2>
      {formError && (
        <div className="alert alert-danger small" role="alert">
          {formError}
        </div>
      )}
      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="profile-name" className="form-label fa-label">
            Full name
          </label>
          <input
            id="profile-name"
            name="name"
            className={`form-control ${errors.name ? 'is-invalid' : ''}`}
            value={form.name}
            onChange={handleChange}
            autoComplete="name"
            maxLength={120}
          />
          {errors.name && <div className="invalid-feedback">{errors.name}</div>}
        </div>
        <div className="col-md-6">
          <label htmlFor="profile-email" className="form-label fa-label">
            Email
          </label>
          <input
            id="profile-email"
            name="email"
            type="email"
            className={`form-control ${errors.email ? 'is-invalid' : ''}`}
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />
          {errors.email && <div className="invalid-feedback">{errors.email}</div>}
        </div>
      </div>
      <hr className="my-4" />
      <div className="d-flex justify-content-end gap-2">
        <button
          type="button"
          className="btn btn-light"
          onClick={() => {
            setForm(initial);
            setErrors({});
            setFormError('');
          }}
          disabled={!dirty || saving}
        >
          Discard changes
        </button>
        <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
          {saving ? (
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          ) : (
            <i className="bi bi-check2 me-1" aria-hidden="true" />
          )}
          Save changes
        </button>
      </div>
    </form>
  );
}

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

function PasswordForm() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const errors = { ...(submitted ? validatePasswordChange(form) : {}), ...serverErrors };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (serverErrors[name]) setServerErrors((e) => ({ ...e, [name]: undefined }));
    setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setServerErrors({});
    setFormError('');
    if (Object.keys(validatePasswordChange(form)).length) return;
    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed. Use your new password next time you sign in.');
      setForm(EMPTY_PASSWORDS);
      setSubmitted(false);
    } catch (err) {
      const apiError = getApiError(err);
      if (apiError.status === 401) {
        setServerErrors({ currentPassword: 'Your current password is incorrect.' });
      } else {
        const mapped = {};
        if (apiError.fields.current_password) mapped.currentPassword = apiError.fields.current_password;
        if (apiError.fields.new_password) mapped.newPassword = apiError.fields.new_password;
        setServerErrors(mapped);
        setFormError(apiError.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h2 className="h6 fw-bold mb-1">Change password</h2>
      <p className="small text-muted mb-3">Use a strong password you don&apos;t use anywhere else.</p>
      {formError && (
        <div className="alert alert-danger small" role="alert">
          {formError}
        </div>
      )}
      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="current-password" className="form-label fa-label">
            Current password
          </label>
          <PasswordInput
            id="current-password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            invalid={Boolean(errors.currentPassword)}
            placeholder="Your current password"
          />
          {errors.currentPassword && <div className="invalid-feedback d-block">{errors.currentPassword}</div>}
        </div>
        <div className="col-md-6 d-none d-md-block" />
        <div className="col-md-6">
          <label htmlFor="new-password" className="form-label fa-label">
            New password
          </label>
          <PasswordInput
            id="new-password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            invalid={Boolean(errors.newPassword)}
            autoComplete="new-password"
            placeholder="Create a strong password"
            describedBy="new-password-rules"
          />
          {errors.newPassword && <div className="invalid-feedback d-block">{errors.newPassword}</div>}
        </div>
        <div className="col-md-6">
          <label htmlFor="confirm-new-password" className="form-label fa-label">
            Confirm new password
          </label>
          <PasswordInput
            id="confirm-new-password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            invalid={Boolean(errors.confirmPassword)}
            autoComplete="new-password"
            placeholder="Repeat the new password"
          />
          {errors.confirmPassword && <div className="invalid-feedback d-block">{errors.confirmPassword}</div>}
        </div>
        <div className="col-12">
          <PasswordChecklist password={form.newPassword} id="new-password-rules" />
        </div>
      </div>
      <hr className="my-4" />
      <div className="d-flex justify-content-end">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? (
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          ) : (
            <i className="bi bi-shield-check me-1" aria-hidden="true" />
          )}
          Update password
        </button>
      </div>
    </form>
  );
}

function StoragePanel({ profile }) {
  const used = Number(profile?.storage_used_bytes) || 0;
  const quota = Number(profile?.storage_quota_bytes) || 0;
  return (
    <div>
      <h2 className="h6 fw-bold mb-3">Storage usage</h2>
      <div className="fa-storage-panel mb-4">
        <StorageWidget usedBytes={used} quotaBytes={quota} />
      </div>
      <div className="row g-3">
        {[
          { label: 'Documents', value: formatNumber(profile?.document_count ?? 0), icon: 'bi-file-earmark-text', tone: 'teal' },
          { label: 'Used', value: formatBytes(used), icon: 'bi-hdd', tone: 'purple' },
          { label: 'Quota', value: quota ? formatBytes(quota) : 'Unlimited', icon: 'bi-hdd-stack', tone: 'cyan' },
          {
            label: 'Free',
            value: quota ? formatBytes(Math.max(quota - used, 0)) : '—',
            icon: 'bi-pie-chart',
            tone: 'green',
          },
        ].map((item) => (
          <div key={item.label} className="col-6 col-md-3">
            <div className="fa-mini-stat">
              <span className={`fa-icon-tile fa-icon-tile-sm fa-tone-${item.tone}`} aria-hidden="true">
                <i className={`bi ${item.icon}`} />
              </span>
              <div>
                <div className="fw-bold">{item.value}</div>
                <div className="small text-muted">{item.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="small text-muted mt-4 mb-0">
        {quota ? `You are using ${formatPercent(used / quota)} of your storage.` : 'No storage limit is set for your account.'}{' '}
        Delete documents you no longer need from the <Link to="/documents">Documents</Link> page to free up space.
      </p>
    </div>
  );
}

function AiPanel() {
  const { config, loading, error, reload } = useAppConfig();
  const providerLabel = (value) => (value ? PROVIDER_LABELS[value] || value : 'Unknown');
  const openAiInUse = config.ai_provider === 'openai' || config.embedding_provider === 'openai';

  if (error && config.status === 'unknown') {
    return <ErrorState compact title="Couldn't reach the server" message={error.message} onRetry={reload} />;
  }

  const rows = [
    { label: 'Document analysis', value: providerLabel(config.ai_provider), icon: 'bi-cpu' },
    { label: 'Semantic search embeddings', value: providerLabel(config.embedding_provider), icon: 'bi-diagram-3' },
    {
      label: 'OCR for scans and images',
      value: config.ocr_available === null ? 'Unknown' : config.ocr_available ? 'Available' : 'Not installed on the server',
      icon: 'bi-eye',
      tone: config.ocr_available === false ? 'text-warning-emphasis' : '',
    },
    { label: 'File storage', value: config.storage_backend ? STORAGE_LABELS[config.storage_backend] || config.storage_backend : 'Unknown', icon: 'bi-hdd-network' },
    { label: 'Maximum upload size', value: `${config.max_upload_mb} MB`, icon: 'bi-upload' },
    { label: 'Supported file types', value: describeExtensions(config.allowed_extensions), icon: 'bi-file-earmark' },
    {
      label: 'Low-confidence warning below',
      value: formatPercent(config.low_confidence_threshold),
      icon: 'bi-exclamation-triangle',
    },
  ];

  return (
    <div>
      <h2 className="h6 fw-bold mb-1">About AI processing</h2>
      <p className="small text-muted mb-3">
        How FileAI analyses your documents. These settings are configured by the server administrator.
      </p>
      <ul className="list-unstyled fa-info-list mb-4">
        {rows.map((row) => (
          <li key={row.label}>
            <i className={`bi ${row.icon}`} aria-hidden="true" />
            <span className="text-muted flex-grow-1">{row.label}</span>
            <span className={`fw-semibold text-end ${row.tone || ''}`}>{loading && config.status === 'unknown' ? <Skeleton width={90} /> : row.value}</span>
          </li>
        ))}
      </ul>
      <div className={`alert ${openAiInUse ? 'alert-warning' : 'alert-info'} d-flex gap-3 mb-0`} role="note">
        <i className="bi bi-shield-exclamation fs-5" aria-hidden="true" />
        <div className="small">
          <div className="fw-semibold mb-1">Privacy note</div>
          If OpenAI is enabled, extracted text is sent to OpenAI for analysis.{' '}
          {openAiInUse
            ? 'OpenAI is currently enabled on this server, so avoid uploading highly sensitive documents.'
            : 'This server currently uses local models, so your document text stays on the FileAI server.'}{' '}
          Every AI suggestion is shown to you for review before it is saved, and you can edit or delete any document at
          any time.
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const signOut = useSignOut();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'profile';
  const [profile, setProfile] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    setProfile((p) => ({ ...p, loading: true, error: null }));
    try {
      const data = await getProfile();
      setProfile({ loading: false, error: null, data });
    } catch (err) {
      setProfile((p) => ({ ...p, loading: false, error: getApiError(err) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = profile.data || user || {};
  const handleSaved = (changes) => {
    setProfile((p) => ({ ...p, data: { ...p.data, ...changes } }));
    updateUser({ name: changes.name ?? data.name, email: changes.email ?? data.email });
  };

  return (
    <div className="fa-page fa-narrow-lg mx-auto">
      <section className="card fa-card fa-profile-card mb-4">
        <div className="fa-profile-banner" aria-hidden="true" />
        <div className="card-body pt-0">
          <div className="d-flex flex-column flex-md-row align-items-md-start gap-3 fa-profile-head">
            <span className="fa-profile-avatar" aria-hidden="true">
              {getInitials(data.name, data.email)}
            </span>
            <div className="flex-grow-1 min-w-0 pt-md-1">
              <h2 className="h5 fw-bold mb-0 text-truncate">{data.name || 'Your profile'}</h2>
              <div className="text-muted small text-truncate">{data.email}</div>
              <div className="d-flex flex-wrap gap-3 small text-muted mt-2">
                {data.created_at && (
                  <span>
                    <i className="bi bi-calendar3 me-1" aria-hidden="true" />
                    Member since {formatDate(data.created_at)}
                  </span>
                )}
                {profile.data && (
                  <>
                    <span>
                      <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />
                      {formatNumber(profile.data.document_count ?? 0)} documents
                    </span>
                    <span>
                      <i className="bi bi-hdd me-1" aria-hidden="true" />
                      {formatBytes(profile.data.storage_used_bytes ?? 0)} used
                    </span>
                  </>
                )}
              </div>
            </div>
            <button type="button" className="btn btn-outline-danger btn-sm align-self-start align-self-md-center" onClick={signOut}>
              <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </section>

      <nav className="fa-tabs mb-4" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`fa-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setParams(t.id === 'profile' ? {} : { tab: t.id }, { replace: true })}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <i className={`bi ${t.icon}`} aria-hidden="true" />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="card fa-card">
        <div className="card-body p-4">
          {profile.loading && !profile.data && tab !== 'ai' && tab !== 'security' ? (
            <div>
              <Skeleton width="30%" height={16} className="mb-4" />
              <Skeleton height={38} className="mb-3" />
              <Skeleton height={38} />
            </div>
          ) : profile.error && !profile.data && (tab === 'profile' || tab === 'storage') ? (
            <ErrorState compact title="Couldn't load your profile" message={profile.error.message} onRetry={load} />
          ) : (
            <>
              {tab === 'profile' && <ProfileForm key={`${data.name}|${data.email}`} profile={data} onSaved={handleSaved} />}
              {tab === 'security' && <PasswordForm />}
              {tab === 'storage' && <StoragePanel profile={profile.data} />}
              {tab === 'ai' && <AiPanel />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
