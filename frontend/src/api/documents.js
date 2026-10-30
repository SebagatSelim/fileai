import api from './client';

/**
 * POST /api/documents (multipart) -> 202 { file_id, status: "PROCESSING" }
 * 409 DUPLICATE_FILE carries error.existing_file.
 */
export async function uploadDocument(file, { allowDuplicate = false, onUploadProgress, signal } = {}) {
  const form = new FormData();
  form.append('file', file);
  form.append('allow_duplicate', allowDuplicate ? 'true' : 'false');
  const { data } = await api.post('/documents', form, {
    onUploadProgress,
    signal,
    timeout: 0, // large files on slow links: no client-side timeout
  });
  return data;
}

/** GET /api/documents/{id}/analysis */
export async function getAnalysis(fileId) {
  const { data } = await api.get(`/documents/${fileId}/analysis`);
  return data;
}

/** POST /api/documents/{id}/approve -> document (status STORED) */
export async function approveDocument(fileId, payload) {
  const { data } = await api.post(`/documents/${fileId}/approve`, payload);
  return data;
}

/** POST /api/documents/{id}/reprocess -> 202 { file_id, status } */
export async function reprocessDocument(fileId) {
  const { data } = await api.post(`/documents/${fileId}/reprocess`);
  return data;
}

/**
 * GET /api/documents -> { items, page, per_page, total }
 * Empty/undefined params are dropped so the backend defaults apply.
 */
export async function listDocuments(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  const { data } = await api.get('/documents', { params: clean });
  return data;
}

/** GET /api/documents/{id} -> document + text_preview + similar_documents */
export async function getDocument(fileId) {
  const { data } = await api.get(`/documents/${fileId}`);
  return data;
}

/** PATCH /api/documents/{id} -> document */
export async function updateDocument(fileId, changes) {
  const { data } = await api.patch(`/documents/${fileId}`, changes);
  return data;
}

/** GET /api/documents/{id}/download?inline= -> { url, expires_in, filename } */
export async function getDownloadUrl(fileId, { inline = false } = {}) {
  const { data } = await api.get(`/documents/${fileId}/download`, {
    params: { inline: inline ? 'true' : 'false' },
  });
  return data;
}

/** DELETE /api/documents/{id} -> 204 */
export async function deleteDocument(fileId) {
  await api.delete(`/documents/${fileId}`);
}
