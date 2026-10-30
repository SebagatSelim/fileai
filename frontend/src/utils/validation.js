// Client-side form validation. Mirrors the server rules in FR-01 so the user
// gets instant feedback; the backend re-validates everything.

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number (0–9)', test: (p) => /[0-9]/.test(p) },
  {
    id: 'special',
    label: 'One special character (e.g. ! @ # $ %)',
    // Any character that is not a letter, digit or whitespace.
    test: (p) => /[^A-Za-z0-9\s]/.test(p),
  },
];

/** Evaluate every FR-01 rule: [{ id, label, met }] */
export function checkPasswordRules(password = '') {
  const value = password || '';
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(value) }));
}

export function isStrongPassword(password = '') {
  return checkPasswordRules(password).every((rule) => rule.met);
}

/** First unmet rule as a sentence, or null when the password is valid. */
export function passwordError(password = '') {
  if (!password) return 'Password is required.';
  const failed = checkPasswordRules(password).find((rule) => !rule.met);
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email = '') {
  return EMAIL_PATTERN.test(String(email).trim());
}

/** Login form: required fields + email format. Returns { field: message }. */
export function validateLogin({ email = '', password = '' }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  return errors;
}

/** Registration form (FR-01). Returns { field: message }. */
export function validateRegistration({
  firstName = '',
  lastName = '',
  email = '',
  password = '',
  confirmPassword = '',
}) {
  const errors = {};
  if (!firstName.trim()) errors.firstName = 'First name is required.';
  if (!lastName.trim()) errors.lastName = 'Last name is required.';
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  const pwError = passwordError(password);
  if (pwError) errors.password = pwError;
  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

/** Change-password form on the settings page. */
export function validatePasswordChange({ currentPassword = '', newPassword = '', confirmPassword = '' }) {
  const errors = {};
  if (!currentPassword) errors.currentPassword = 'Enter your current password.';
  const pwError = passwordError(newPassword);
  if (pwError) errors.newPassword = pwError;
  else if (newPassword === currentPassword) errors.newPassword = 'Choose a password different from your current one.';
  if (!confirmPassword) errors.confirmPassword = 'Please confirm your new password.';
  else if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

// Characters that are not allowed in filenames on Windows / macOS / S3 keys.
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;

export function filenameError(filename = '') {
  const value = filename.trim();
  if (!value) return 'Filename is required.';
  if (INVALID_FILENAME_CHARS.test(value)) return 'Filename cannot contain \\ / : * ? " < > |';
  if (value.length > 255) return 'Filename is too long (max 255 characters).';
  return null;
}

export function folderSegmentError(segment = '') {
  const value = String(segment).trim();
  if (!value) return 'Folder name cannot be empty.';
  if (/[\\/]/.test(value)) return 'Folder names cannot contain / or \\.';
  if (value.length > 100) return 'Folder name is too long.';
  return null;
}

/** Trim folder segments and drop empty ones: [" Uni ", "", "Year 2"] -> ["Uni", "Year 2"] */
export function cleanSegments(segments = []) {
  return (segments || []).map((s) => String(s).trim()).filter(Boolean);
}

/**
 * Metadata checks shared by "Approve & Save" and "Edit metadata".
 * Returns { field: message } using the API's field names.
 */
export function validateDocumentMetadata(values = {}, { requireFolder = true } = {}) {
  const errors = {};
  if (!String(values.title || '').trim()) errors.title = 'Title is required.';
  const fnError = filenameError(values.filename || '');
  if (fnError) errors.filename = fnError;
  if (!String(values.category || '').trim()) errors.category = 'Category is required.';
  if (requireFolder) {
    const segments = cleanSegments(values.folder_path);
    if (!segments.length) {
      errors.folder_path = 'Choose an existing folder or type at least one folder name.';
    } else {
      const segmentError = segments.map(folderSegmentError).find(Boolean);
      if (segmentError) errors.folder_path = segmentError;
    }
  }
  return errors;
}
