import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from './RegisterPage';
import * as authApi from '../api/auth';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(() => new Promise(() => {})),
}));

function renderRegister() {
  return renderWithProviders({
    initialPath: '/register',
    routes: [
      { path: '/register', element: <RegisterPage /> },
      { path: '/login', element: <h1>Login page</h1> },
    ],
  });
}

async function fillForm(user, overrides = {}) {
  const values = {
    first: 'Alex',
    last: 'Chen',
    email: 'alex@uni.edu',
    password: 'Str0ng!Pass',
    confirm: 'Str0ng!Pass',
    ...overrides,
  };
  if (values.first) await user.type(screen.getByLabelText('First name'), values.first);
  if (values.last) await user.type(screen.getByLabelText('Last name'), values.last);
  if (values.email) await user.type(screen.getByLabelText('Email address'), values.email);
  if (values.password) await user.type(screen.getByLabelText('Password'), values.password);
  if (values.confirm) await user.type(screen.getByLabelText('Confirm password'), values.confirm);
}

describe('RegisterPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the password checklist live', async () => {
    const user = userEvent.setup();
    renderRegister();
    const checklist = screen.getByText('At least 8 characters').closest('ul');
    expect(within(checklist).getAllByText('(not met)', { exact: false })).toHaveLength(5);

    await user.type(screen.getByLabelText('Password'), 'abc');
    expect(within(checklist).getAllByText('(met)', { exact: false })).toHaveLength(1); // lowercase only

    await user.type(screen.getByLabelText('Password'), 'DEF12!');
    expect(within(checklist).queryAllByText('(not met)', { exact: false })).toHaveLength(0);
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('blocks submission when passwords do not match', async () => {
    const user = userEvent.setup();
    renderRegister();
    await fillForm(user, { confirm: 'Str0ng!Pas' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getAllByText('Passwords do not match.').length).toBeGreaterThan(0);
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('sends "first last" as name and redirects to login on success', async () => {
    authApi.register.mockResolvedValue({ user_id: 7, message: 'Registration successful' });
    const user = userEvent.setup();
    renderRegister();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    expect(authApi.register).toHaveBeenCalledWith({
      name: 'Alex Chen',
      email: 'alex@uni.edu',
      password: 'Str0ng!Pass',
    });
  });

  it('shows EMAIL_EXISTS on the email field', async () => {
    authApi.register.mockRejectedValue({
      response: { status: 409, data: { error: { code: 'EMAIL_EXISTS', message: 'Email is already registered.' } } },
    });
    const user = userEvent.setup();
    renderRegister();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Email is already registered.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveClass('is-invalid');
  });
});
