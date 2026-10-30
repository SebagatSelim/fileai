// Helpers around GET /api/documents/{id}/download, which returns a short-lived
// URL (pre-signed S3 or a relative /api/files/<token> link that needs no auth header).
import { getDownloadUrl } from '../api/documents';

/** Start a file download in the current tab. */
export async function downloadDocument(fileId) {
  const { url } = await getDownloadUrl(fileId, { inline: false });
  window.location.assign(url);
}

/**
 * Open the original file in a new tab. The tab is opened synchronously (before
 * the API call) so pop-up blockers allow it.
 */
export async function openDocumentInNewTab(fileId) {
  const win = window.open('about:blank', '_blank');
  try {
    const { url } = await getDownloadUrl(fileId, { inline: true });
    if (win) win.location.href = url;
    else window.location.assign(url);
  } catch (err) {
    win?.close();
    throw err;
  }
}
