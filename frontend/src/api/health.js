import api from './client';

/** GET /api/health (no auth) -> server capabilities and limits. */
export async function getHealth() {
  const { data } = await api.get('/health', { skipAuth: true, skipAuthRedirect: true, timeout: 10000 });
  return data;
}
