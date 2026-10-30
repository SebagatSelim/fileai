import { checkPasswordRules } from '../utils/validation';

/** Live FR-01 password rule checklist shown under a new-password field. */
export default function PasswordChecklist({ password = '', id }) {
  const rules = checkPasswordRules(password);
  const metCount = rules.filter((r) => r.met).length;
  const strength = metCount / rules.length;
  let strengthLabel = 'Too weak';
  let tone = 'danger';
  if (metCount === rules.length) {
    strengthLabel = 'Strong';
    tone = 'success';
  } else if (metCount >= 3) {
    strengthLabel = 'Almost there';
    tone = 'warning';
  }

  return (
    <div className="fa-password-checklist mt-2" id={id} aria-live="polite">
      <div className="d-flex align-items-center gap-2 mb-2">
        <div
          className="progress flex-grow-1"
          style={{ height: 6 }}
          role="progressbar"
          aria-label="Password strength"
          aria-valuenow={metCount}
          aria-valuemin={0}
          aria-valuemax={rules.length}
        >
          <div className={`progress-bar bg-${password ? tone : 'secondary'}`} style={{ width: `${strength * 100}%` }} />
        </div>
        <span className={`small fw-semibold text-${password ? tone : 'secondary'}`}>
          {password ? strengthLabel : 'Password rules'}
        </span>
      </div>
      <ul className="list-unstyled row row-cols-1 row-cols-sm-2 g-1 small mb-0">
        {rules.map((rule) => (
          <li key={rule.id} className={`col d-flex align-items-center gap-2 ${rule.met ? 'text-success' : 'text-muted'}`}>
            <i className={`bi ${rule.met ? 'bi-check-circle-fill' : 'bi-circle'}`} aria-hidden="true" />
            <span>
              {rule.label}
              <span className="visually-hidden">{rule.met ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
