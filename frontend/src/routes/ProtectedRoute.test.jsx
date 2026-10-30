import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import api, { TOKEN_KEY, saveSession } from '../api/client';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(() => new Promise(() => {})),
}));

const unauthorized = async (config) => {
  const response = { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Token expired' } }, headers: {}, config };
  throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, response);
};

/** A protected page whose first API call is rejected with 401. */
function ExpiringPage() {
  useEffect(() => {
    api.get('/dashboard/stats', { adapter: unauthorized }).catch(() => {});
  }, []);
  return <h1>Secret dashboard</h1>;
}

const routes = (page) => [
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <ProtectedRoute>{page}</ProtectedRoute> },
];

describe('ProtectedRoute', () => {
  it('redirects anonymous users to /login', async () => {
    renderWithProviders({ initialPath: '/', routes: routes(<h1>Secret dashboard</h1>) });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('renders the page for signed-in users', () => {
    saveSession({ token: 'valid', user: { name: 'Alex Chen' }, expiresIn: 600 });
    renderWithProviders({ initialPath: '/', routes: routes(<h1>Secret dashboard</h1>) });
    expect(screen.getByText('Secret dashboard')).toBeInTheDocument();
  });

  it('clears the session and shows "session expired" after a 401', async () => {
    saveSession({ token: 'stale', user: { name: 'Alex Chen' }, expiresIn: 600 });
    renderWithProviders({ initialPath: '/', routes: routes(<ExpiringPage />) });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
