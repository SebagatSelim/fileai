// Formatting helpers shared by every page. All functions are pure so they can
// be unit-tested without a browser.

const LOCALE = 'en-AU';
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/**
 * Human-readable file size using binary (1024) units.
 * formatBytes(1536) -> "1.5 KB", formatBytes(0) -> "0 B", formatBytes(null) -> "—"
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === null || bytes === undefined || bytes === '' || Number.isNaN(Number(bytes))) {
    return '—';
  }
  const value = Number(bytes);
  if (value <= 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), BYTE_UNITS.length - 1);
  const scaled = value / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : decimals;
  // Number(...) drops trailing zeros: "2.0" -> 2
  return `${Number(scaled.toFixed(digits))} ${BYTE_UNITS[exponent]}`;
}

/** Parse an ISO 8601 string (or Date/number) into a Date, or null when invalid. */
export function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Absolute date, e.g. "30 Oct 2026" or, with { withTime: true },
 * "30 Oct 2026, 2:15 pm".
 */
export function formatDate(value, { withTime = false } = {}) {
  const date = parseDate(value);
  if (!date) return '—';
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }
  return new Intl.DateTimeFormat(LOCALE, options).format(date);
}

/**
 * Relative time for activity feeds: "just now", "12 min ago", "3 hr ago",
 * "Yesterday", "4 days ago", then falls back to an absolute date.
 */
export function formatRelativeTime(value, now = Date.now()) {
  const date = parseDate(value);
  if (!date) return '—';
  const nowMs = now instanceof Date ? now.getTime() : now;
  const seconds = Math.round((nowMs - date.getTime()) / 1000);

  if (seconds < 0) return formatDate(date); // clock skew / future timestamps
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

/** 0.912 -> "91%". Returns "—" for null/undefined. */
export function formatPercent(fraction, decimals = 0) {
  if (fraction === null || fraction === undefined || Number.isNaN(Number(fraction))) return '—';
  return `${(Number(fraction) * 100).toFixed(decimals)}%`;
}

/** Clamp a 0–1 fraction to a 0–100 integer suitable for progress bars. */
export function toPercentInt(fraction) {
  if (fraction === null || fraction === undefined || Number.isNaN(Number(fraction))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(fraction) * 100)));
}

/** 1284 -> "1,284" */
export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(LOCALE).format(Number(value));
}

/**
 * "2026-10" -> "Oct" (or "Oct 2026" when includeYear is true).
 */
export function formatMonth(yearMonth, { includeYear = false } = {}) {
  if (!yearMonth || typeof yearMonth !== 'string') return '';
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month) return yearMonth;
  const date = new Date(Date.UTC(year, month - 1, 1));
  const options = { month: 'short', timeZone: 'UTC' };
  if (includeYear) options.year = 'numeric';
  return new Intl.DateTimeFormat(LOCALE, options).format(date);
}

/** "Alex Chen" -> "Alex". Falls back to the email local part or "there". */
export function getFirstName(name, email) {
  const trimmed = (name || '').trim();
  if (trimmed) return trimmed.split(/\s+/)[0];
  if (email) return email.split('@')[0];
  return 'there';
}

/** "Alex Chen" -> "AC", "alex" -> "A" */
export function getInitials(name, email) {
  const source = (name || '').trim() || (email || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Time-of-day greeting for the dashboard hero banner. */
export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "AI_CLASSIFIED" -> "AI classified", "upload" -> "Upload" */
export function humanize(value) {
  if (!value) return '';
  const text = String(value).replace(/[_-]+/g, ' ').trim().toLowerCase();
  const withAcronyms = text.replace(/\b(ai|ocr|pdf|docx|txt|png|jpg)\b/g, (m) => m.toUpperCase());
  return withAcronyms.charAt(0).toUpperCase() + withAcronyms.slice(1);
}

/** Pluralise: plural(1, 'document') -> "1 document", plural(3, 'document') -> "3 documents" */
export function plural(count, singular, pluralForm) {
  const n = Number(count) || 0;
  return `${formatNumber(n)} ${n === 1 ? singular : pluralForm || `${singular}s`}`;
}
