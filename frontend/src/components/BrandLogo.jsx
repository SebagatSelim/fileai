/** FileAI logo mark + optional wordmark and tagline. */
export default function BrandLogo({ size = 40, showText = true, tagline = true, className = '', textClassName = '' }) {
  return (
    <div className={`fa-brand d-flex align-items-center gap-2 ${className}`}>
      <span className="fa-brand-mark" style={{ width: size, height: size }} aria-hidden="true">
        <i className="bi bi-file-earmark-fill" style={{ fontSize: size * 0.5 }} />
        <span className="fa-brand-spark">
          <i className="bi bi-stars" />
        </span>
      </span>
      {showText && (
        <span className={`d-flex flex-column lh-sm ${textClassName}`}>
          <span className="fa-brand-name">FileAI</span>
          {tagline && <span className="fa-brand-tagline">Organize smarter with AI</span>}
        </span>
      )}
    </div>
  );
}
