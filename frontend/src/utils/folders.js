// Helpers for the folder tree returned by GET /api/folders:
// [{ folder_id, name, parent_folder_id, path: "University/Year 2", document_count, children: [...] }]

export const PATH_SEPARATOR = '/';

/** "University/Year 2" -> ["University", "Year 2"]; null -> [] */
export function splitPath(path) {
  if (Array.isArray(path)) return path.filter((s) => s && String(s).trim()).map((s) => String(s).trim());
  if (!path) return [];
  return String(path)
    .split(PATH_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ["University", "Year 2"] -> "University/Year 2" */
export function joinPath(segments) {
  return splitPath(segments).join(PATH_SEPARATOR);
}

/** Display form with spaced separators: "University / Year 2" */
export function displayPath(pathOrSegments, emptyLabel = 'Not filed') {
  const segments = splitPath(pathOrSegments);
  return segments.length ? segments.join(' / ') : emptyLabel;
}

/**
 * Depth-first flatten of the folder tree, preserving order.
 * Each entry gets a computed `path` (if missing) and `depth`.
 */
export function flattenFolders(tree = [], parentPath = '', depth = 0) {
  const result = [];
  (tree || []).forEach((folder) => {
    const path = folder.path || (parentPath ? `${parentPath}${PATH_SEPARATOR}${folder.name}` : folder.name);
    result.push({
      folder_id: folder.folder_id,
      name: folder.name,
      parent_folder_id: folder.parent_folder_id ?? null,
      path,
      depth,
      document_count: folder.document_count ?? 0,
      hasChildren: Boolean(folder.children && folder.children.length),
    });
    if (folder.children && folder.children.length) {
      result.push(...flattenFolders(folder.children, path, depth + 1));
    }
  });
  return result;
}

/** Find a folder node (with children) by id anywhere in the tree. */
export function findFolderById(tree = [], folderId) {
  for (const folder of tree || []) {
    if (String(folder.folder_id) === String(folderId)) return folder;
    const found = findFolderById(folder.children, folderId);
    if (found) return found;
  }
  return null;
}

/** Ids of every ancestor of the given folder (root first). */
export function ancestorIds(tree = [], folderId, trail = []) {
  for (const folder of tree || []) {
    if (String(folder.folder_id) === String(folderId)) return trail;
    const found = ancestorIds(folder.children, folderId, [...trail, folder.folder_id]);
    if (found) return found;
  }
  return null;
}

/**
 * Names of the existing child folders under the given parent segments, used
 * for per-segment autocomplete in the folder path editor.
 * childNamesAt(tree, []) -> top-level names; childNamesAt(tree, ["University"]) -> its children.
 */
export function childNamesAt(tree = [], parentSegments = []) {
  let level = tree || [];
  for (const segment of parentSegments) {
    const match = level.find((f) => f.name.toLowerCase() === String(segment).trim().toLowerCase());
    if (!match) return [];
    level = match.children || [];
  }
  return level.map((f) => f.name);
}

/** Total number of folders in the tree. */
export function countFolders(tree = []) {
  return flattenFolders(tree).length;
}
