import api from './client';

/** GET /api/categories -> [{ category, count }] */
export async function getCategories() {
  const { data } = await api.get('/categories');
  return Array.isArray(data) ? data : [];
}
