// File-type helpers: icons, colours, extension checks and client-side upload
// validation (FR-02). The server re-validates by content (FR-08).

export const DEFAULT_ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg'];
export const DEFAULT_MAX_UPLOAD_MB = 20;

// Extension -> MIME types, used to build react-dropzone's `accept` map so the
// browser's file dialog only offers supported files.
const MIME_BY_EXTENSION = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  txt: ['text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
};

const TYPE_META = {
  PDF: { icon: 'bi-file-earmark-pdf', className: 'ft-pdf', label: 'PDF document' },
  DOCX: { icon: 'bi-file-earmark-word', className: 'ft-docx', label: 'Word document' },
  TXT: { icon: 'bi-file-earmark-text', className: 'ft-txt', label: 'Plain text' },
  PNG: { icon: 'bi-file-earmark-image', className: 'ft-png', label: 'PNG image' },
  JPG: { icon: 'bi-file-earmark-image', className: 'ft-jpg', label: 'JPEG image' },
};

const FALLBACK_META = { icon: 'bi-file-earmark', className: 'ft-other', label: 'File' };

/** "Report.Final.PDF" -> "pdf"; "" when there is no extension. */
export function getExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const base = filename.split(/[\\/]/).pop();
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Normalise either a backend file_type ("PDF", "JPG") or a filename/extension
 * ("photo.jpeg", "jpeg") to one of PDF | DOCX | TXT | PNG | JPG, or "" if unknown.
 */
export function normaliseFileType(typeOrName) {
  if (!typeOrName) return '';
  const raw = String(typeOrName).trim();
  const upper = raw.toUpperCase();
  if (TYPE_META[upper]) return upper;
  if (upper === 'JPEG') return 'JPG';
  const ext = getExtension(raw).toUpperCase();
  if (ext === 'JPEG') return 'JPG';
  return TYPE_META[ext] ? ext : '';
}

/** Bootstrap-icons class for a file type or filename, e.g. "bi-file-earmark-pdf". */
export function fileTypeIcon(typeOrName) {
  const type = normaliseFileType(typeOrName);
  return (TYPE_META[type] || FALLBACK_META).icon;
}

/** CSS colour class for a file type (see styles/app.css .ft-*). */
export function fileTypeClass(typeOrName) {
  const type = normaliseFileType(typeOrName);
  return (TYPE_META[type] || FALLBACK_META).className;
}

export function fileTypeLabel(typeOrName) {
  const type = normaliseFileType(typeOrName);
  return (TYPE_META[type] || FALLBACK_META).label;
}

export const FILE_TYPE_OPTIONS = Object.keys(TYPE_META);

/** Previewable in the browser via the download URL (iframe / img). */
export function isInlinePreviewable(fileType) {
  const type = normaliseFileType(fileType);
  return type === 'PDF' || type === 'PNG' || type === 'JPG';
}

export function isImageType(fileType) {
  const type = normaliseFileType(fileType);
  return type === 'PNG' || type === 'JPG';
}

/** react-dropzone `accept` object built from the allowed extension list. */
export function buildAcceptMap(allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS) {
  const accept = {};
  allowedExtensions.forEach((ext) => {
    const key = String(ext).toLowerCase().replace(/^\./, '');
    (MIME_BY_EXTENSION[key] || []).forEach((mime) => {
      accept[mime] = accept[mime] || [];
      if (!accept[mime].includes(`.${key}`)) accept[mime].push(`.${key}`);
    });
  });
  return accept;
}

/** ".pdf, .docx, .txt" for help text. */
export function describeExtensions(allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS) {
  return allowedExtensions.map((ext) => `.${String(ext).replace(/^\./, '').toLowerCase()}`).join(', ');
}

/**
 * Client-side upload check (type + size). Returns an error message, or null
 * when the file is acceptable.
 */
export function validateUploadFile(
  file,
  { allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS, maxUploadMb = DEFAULT_MAX_UPLOAD_MB } = {},
) {
  if (!file) return 'No file selected.';
  const ext = getExtension(file.name);
  const allowed = allowedExtensions.map((e) => String(e).toLowerCase().replace(/^\./, ''));
  if (!ext || !allowed.includes(ext)) {
    return `Unsupported file type${ext ? ` (.${ext})` : ''}. Allowed: ${describeExtensions(allowed)}.`;
  }
  if (file.size === 0) {
    return 'This file is empty.';
  }
  const maxBytes = maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return `File is too large. The maximum size is ${maxUploadMb} MB.`;
  }
  return null;
}
