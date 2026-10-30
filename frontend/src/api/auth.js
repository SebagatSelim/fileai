import api from './client';

/** POST /api/auth/register -> { user_id, message } */
export async function register({ name, email, password }) {
  const { data } = await api.post(
    '/auth/register',
    { name, email, password },
    { skipAuth: true, skipAuthRedirect: true },
  );
  return data;
}

/** POST /api/auth/login -> { access_token, expires_in, user } */
export async function login({ email, password }) {
  const { data } = await api.post(
    '/auth/login',
    { email, password },
    { skipAuth: true, skipAuthRedirect: true },
  );
  return data;
}

/** GET /api/auth/me -> { user_id, name, email, created_at } */
export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

/** POST /api/auth/logout -> 204. Never triggers the 401 redirect. */
export async function logout() {
  await api.post('/auth/logout', null, { skipAuthRedirect: true });
}
