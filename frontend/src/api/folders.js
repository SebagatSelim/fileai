import api from './client';

/** GET /api/folders -> folder tree */
export async function getFolders() {
  const { data } = await api.get('/folders');
  return Array.isArray(data) ? data : [];
}

/** POST /api/folders { name, parent_folder_id } -> 201 folder; 409 FOLDER_EXISTS */
export async function createFolder({ name, parentFolderId = null }) {
  const { data } = await api.post('/folders', { name, parent_folder_id: parentFolderId });
  return data;
}
