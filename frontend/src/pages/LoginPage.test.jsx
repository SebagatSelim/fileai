import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import * as authApi from '../api/auth';
import { renderWithProviders } from '../test/renderWithProviders';
import { TOKEN_KEY, USER_KEY } from '../api/client';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(() => new Promise(() => {})),
}));

function renderLogin() {
  return renderWithProviders({
    initialPath: '/login',
    routes: [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <h1>Dashboard home</h1> },
      { path: '/register', element: <h1>Register page</h1> },
    ],
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the sign-in form with a masked password', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
  });

  it('shows required-field errors and does not call the API', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Sign in to FileAI' }));
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('validates the email format', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Sign in to FileAI' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('signs in, stores the token in sessionStorage and goes to the dashboard', async () => {
    authApi.login.mockResolvedValue({
      access_token: 'jwt-123',
      expires_in: 1800,
      user: { user_id: 1, name: 'Alex Chen', email: 'alex@uni.edu' },
    });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'alex@uni.edu');
    await user.type(screen.getByLabelText('Password'), 'Str0ng!Pass');
    await user.click(screen.getByRole('button', { name: 'Sign in to FileAI' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    expect(authApi.login).toHaveBeenCalledWith({ email: 'alex@uni.edu', password: 'Str0ng!Pass' });
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('jwt-123');
    expect(JSON.parse(window.sessionStorage.getItem(USER_KEY)).name).toBe('Alex Chen');
  });

  it('shows the API error message on a failed login', async () => {
    authApi.login.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password.' } } },
    });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'alex@uni.edu');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in to FileAI' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });
});
