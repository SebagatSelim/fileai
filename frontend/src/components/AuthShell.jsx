import BrandLogo from './BrandLogo';

/** Background, logo and footer shared by the login and registration pages. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="fa-auth">
      <div className="fa-auth-blob fa-auth-blob-1" aria-hidden="true" />
      <div className="fa-auth-blob fa-auth-blob-2" aria-hidden="true" />
      <div className="fa-auth-blob fa-auth-blob-3" aria-hidden="true" />
      <main className="fa-auth-inner">
        <div className="text-center mb-4">
          <div className="d-inline-flex flex-column align-items-center gap-2">
            <BrandLogo size={56} showText={false} />
            <div>
              <div className="fa-auth-brand">FileAI</div>
              <div className="fa-auth-tagline">Organize smarter with AI</div>
            </div>
          </div>
        </div>
        <div className="card fa-auth-card">
          <div className="card-body p-4 p-sm-5">
            <h1 className="h4 fw-bold mb-1">{title}</h1>
            {subtitle && <p className="text-muted small mb-4">{subtitle}</p>}
            {children}
          </div>
        </div>
        {footer && <div className="text-center mt-3">{footer}</div>}
        <p className="fa-auth-footer text-center mt-4 mb-0">
          © {new Date().getFullYear()} FileAI · AI-Powered · University Capstone Project
        </p>
      </main>
    </div>
  );
}
