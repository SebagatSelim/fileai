import { lazy, Suspense } from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { LoadingState } from './components/Feedback';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicOnlyRoute from './routes/PublicOnlyRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Signed-in pages are split into their own chunks (chart.js only loads with the dashboard).
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const DocumentDetailsPage = lazy(() => import('./pages/DocumentDetailsPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const ReviewQueuePage = lazy(() => import('./pages/ReviewQueuePage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const FoldersPage = lazy(() => import('./pages/FoldersPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/** Remount a page when its :id changes so no state leaks between documents. */
function KeyedById({ component: Component }) {
  const { id } = useParams();
  return <Component key={id} />;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Loading FileAI…" className="min-vh-100 d-flex flex-column justify-content-center" />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="documents/:id" element={<KeyedById component={DocumentDetailsPage} />} />
            <Route path="documents/:id/review" element={<KeyedById component={ReviewPage} />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="review" element={<ReviewQueuePage />} />
            <Route path="folders" element={<FoldersPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
