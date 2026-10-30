// Display metadata for document statuses, activity actions and categories.
import { humanize } from './format';

export const DOCUMENT_STATUSES = ['UPLOADED', 'PROCESSING', 'AWAITING_REVIEW', 'STORED', 'FAILED'];
export const TERMINAL_ANALYSIS_STATUSES = ['AWAITING_REVIEW', 'STORED', 'FAILED'];

const STATUS_META = {
  UPLOADED: { label: 'Uploaded', tone: 'secondary', icon: 'bi-cloud-check' },
  PROCESSING: { label: 'Analysing', tone: 'info', icon: 'bi-cpu' },
  AWAITING_REVIEW: { label: 'Awaiting review', tone: 'warning', icon: 'bi-hourglass-split' },
  STORED: { label: 'Stored', tone: 'success', icon: 'bi-check-circle' },
  FAILED: { label: 'Failed', tone: 'danger', icon: 'bi-exclamation-octagon' },
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: humanize(status) || 'Unknown', tone: 'secondary', icon: 'bi-question-circle' };
}

export function isTerminalStatus(status) {
  return TERMINAL_ANALYSIS_STATUSES.includes(status);
}

// recent_activity[].action values are not fixed by the API contract, so we
// match on keywords and fall back to a humanised label.
const ACTIVITY_RULES = [
  { match: /DUPLIC/, icon: 'bi-files', tone: 'amber', label: 'Duplicate detected' },
  { match: /FAIL|ERROR/, icon: 'bi-exclamation-triangle', tone: 'red', label: 'Processing failed' },
  { match: /REPROCESS|RETRY/, icon: 'bi-arrow-repeat', tone: 'blue', label: 'Reprocessing' },
  { match: /OCR/, icon: 'bi-eye', tone: 'green', label: 'OCR completed' },
  { match: /CLASSIF|ANALY/, icon: 'bi-cpu', tone: 'teal', label: 'AI classified' },
  { match: /APPROV|STORE|SAVE/, icon: 'bi-check2-circle', tone: 'green', label: 'Approved & stored' },
  { match: /UPLOAD/, icon: 'bi-cloud-arrow-up', tone: 'purple', label: 'Uploaded' },
  { match: /DOWNLOAD/, icon: 'bi-download', tone: 'blue', label: 'Downloaded' },
  { match: /DELET|REMOV|DISCARD/, icon: 'bi-trash3', tone: 'red', label: 'Deleted' },
  { match: /MOVE/, icon: 'bi-folder-symlink', tone: 'blue', label: 'Moved' },
  { match: /RENAM/, icon: 'bi-input-cursor-text', tone: 'blue', label: 'Renamed' },
  { match: /UPDAT|EDIT|PATCH/, icon: 'bi-pencil-square', tone: 'blue', label: 'Updated' },
  { match: /SEARCH/, icon: 'bi-search', tone: 'teal', label: 'Searched' },
  { match: /FOLDER/, icon: 'bi-folder-plus', tone: 'amber', label: 'Folder created' },
  { match: /LOGIN|SIGN/, icon: 'bi-box-arrow-in-right', tone: 'slate', label: 'Signed in' },
];

export function activityMeta(action) {
  const key = String(action || '').toUpperCase();
  const rule = ACTIVITY_RULES.find((r) => r.match.test(key));
  if (rule) return rule;
  return { icon: 'bi-activity', tone: 'slate', label: humanize(action) || 'Activity' };
}

export function isDeletionAction(action) {
  return /DELET|REMOV|DISCARD/.test(String(action || '').toUpperCase());
}

const CATEGORY_ICONS = [
  { match: /univ|study|academ|school|course|assign|lecture|semester/i, icon: 'bi-mortarboard' },
  { match: /financ|invoice|bank|tax|receipt|bill|pay/i, icon: 'bi-cash-coin' },
  { match: /career|resume|cv|job|employ/i, icon: 'bi-briefcase' },
  { match: /work|business|project|meeting/i, icon: 'bi-building' },
  { match: /medic|health|doctor/i, icon: 'bi-heart-pulse' },
  { match: /legal|contract|agreement|policy/i, icon: 'bi-bank' },
  { match: /personal|family|home/i, icon: 'bi-person' },
  { match: /travel|trip|ticket/i, icon: 'bi-airplane' },
  { match: /photo|image|design|picture/i, icon: 'bi-image' },
  { match: /research|paper|science/i, icon: 'bi-journal-text' },
  { match: /uncategor|other|misc/i, icon: 'bi-question-square' },
];

export function categoryIcon(category) {
  const rule = CATEGORY_ICONS.find((r) => r.match.test(String(category || '')));
  return rule ? rule.icon : 'bi-tag';
}

// Stable colour per category name so badges/charts stay consistent.
export const CATEGORY_PALETTE = [
  '#0f766e', '#0891b2', '#7c3aed', '#f59e0b', '#ef4444',
  '#10b981', '#3b82f6', '#ec4899', '#0ea5e9', '#84cc16',
];

export function categoryColor(category) {
  const text = String(category || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}
