import api from './client';

/** GET /api/dashboard/stats */
export async function getDashboardStats() {
  const { data } = await api.get('/dashboard/stats');
  return data;
}
