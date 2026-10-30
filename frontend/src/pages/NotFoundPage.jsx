import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { isAuthenticated } = useAuth();
  return (
    <div className="fa-notfound">
      <div className="text-center px-3">
        <BrandLogo size={48} className="justify-content-center mb-4" />
        <div className="fa-notfound-code" aria-hidden="true">
          404
        </div>
        <h1 className="h4 fw-bold mb-2">We couldn&apos;t find that page</h1>
        <p className="text-muted mb-4">The link may be broken, or the page may have moved.</p>
        <div className="d-flex justify-content-center gap-2">
          {isAuthenticated ? (
            <>
              <Link to="/" className="btn btn-primary">
                <i className="bi bi-grid-1x2 me-1" aria-hidden="true" />
                Back to dashboard
              </Link>
              <Link to="/search" className="btn btn-light">
                <i className="bi bi-search me-1" aria-hidden="true" />
                Search documents
              </Link>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              Go to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
