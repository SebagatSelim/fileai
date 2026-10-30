import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatMonth,
  formatPercent,
  formatRelativeTime,
  getFirstName,
  getGreeting,
  getInitials,
  humanize,
  plural,
  toPercentInt,
} from './format';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [2560000, '2.4 MB'],
    [10200547328, '9.5 GB'],
    [16106127360, '15 GB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('returns a dash for missing values', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes('abc')).toBe('—');
  });

  it('respects the decimals argument', () => {
    expect(formatBytes(1234567, 2)).toBe('1.18 MB');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');

  it.each([
    ['2026-10-30T11:59:40Z', 'just now'],
    ['2026-10-30T11:48:00Z', '12 min ago'],
    ['2026-10-30T09:00:00Z', '3 hr ago'],
    ['2026-10-29T10:00:00Z', 'Yesterday'],
    ['2026-10-26T12:00:00Z', '4 days ago'],
  ])('%s -> %s', (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected);
  });

  it('falls back to an absolute date after a week', () => {
    expect(formatRelativeTime('2026-09-01T00:00:00Z', now)).toMatch(/2026/);
  });

  it('handles invalid input', () => {
    expect(formatRelativeTime('not a date', now)).toBe('—');
    expect(formatRelativeTime(null, now)).toBe('—');
  });
});

describe('small formatters', () => {
  it('formats percentages', () => {
    expect(formatPercent(0.912)).toBe('91%');
    expect(formatPercent(null)).toBe('—');
    expect(toPercentInt(1.4)).toBe(100);
    expect(toPercentInt(-1)).toBe(0);
    expect(toPercentInt(0.456)).toBe(46);
  });

  it('formats months', () => {
    expect(formatMonth('2026-10')).toBe('Oct');
    expect(formatMonth('2026-01', { includeYear: true })).toMatch(/Jan.*2026/);
    expect(formatMonth('')).toBe('');
  });

  it('extracts names and initials', () => {
    expect(getFirstName('Alex Chen')).toBe('Alex');
    expect(getFirstName('', 'sam@uni.edu')).toBe('sam');
    expect(getFirstName('', '')).toBe('there');
    expect(getInitials('Alex Chen')).toBe('AC');
    expect(getInitials('Maria del Carmen Lopez')).toBe('ML');
    expect(getInitials('', 'zoe@uni.edu')).toBe('Z');
  });

  it('greets by time of day', () => {
    expect(getGreeting(new Date(2026, 9, 30, 8))).toBe('Good morning');
    expect(getGreeting(new Date(2026, 9, 30, 14))).toBe('Good afternoon');
    expect(getGreeting(new Date(2026, 9, 30, 20))).toBe('Good evening');
  });

  it('humanizes action codes and pluralises', () => {
    expect(humanize('AI_CLASSIFIED')).toBe('AI classified');
    expect(humanize('upload')).toBe('Upload');
    expect(plural(1, 'document')).toBe('1 document');
    expect(plural(1284, 'document')).toBe('1,284 documents');
    expect(plural(2, 'category', 'categories')).toBe('2 categories');
  });
});
