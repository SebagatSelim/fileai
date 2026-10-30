import api from './client';

/** POST /api/search -> { query, results: [document + relevance], took_ms } */
export async function searchDocuments(query, { limit = 20, signal } = {}) {
  const { data } = await api.post('/search', { query, limit }, { signal });
  return data;
}
