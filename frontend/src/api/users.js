import api from './client';

/** GET /api/users/me -> profile + storage usage */
export async function getProfile() {
  const { data } = await api.get('/users/me');
  return data;
}

/** PATCH /api/users/me { name?, email? } -> user */
export async function updateProfile(changes) {
  const { data } = await api.patch('/users/me', changes);
  return data;
}

/**
 * PUT /api/users/me/password -> 204.
 * A 401 here means "current password is wrong", not "session expired", so the
 * global 401 redirect is skipped for this call.
 */
export async function changePassword({ currentPassword, newPassword }) {
  await api.put(
    '/users/me/password',
    { current_password: currentPassword, new_password: newPassword },
    { skipAuthRedirect: true },
  );
}
