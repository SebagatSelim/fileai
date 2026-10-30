import { describe, expect, it } from 'vitest';
import {
  checkPasswordRules,
  cleanSegments,
  filenameError,
  isStrongPassword,
  isValidEmail,
  passwordError,
  validateDocumentMetadata,
  validateLogin,
  validatePasswordChange,
  validateRegistration,
} from './validation';

const ruleMap = (password) => Object.fromEntries(checkPasswordRules(password).map((r) => [r.id, r.met]));

describe('password rules (FR-01)', () => {
  it('accepts a password that meets every rule', () => {
    expect(isStrongPassword('Str0ng!Pass')).toBe(true);
    expect(passwordError('Str0ng!Pass')).toBeNull();
    expect(Object.values(ruleMap('Str0ng!Pass')).every(Boolean)).toBe(true);
  });

  it.each([
    ['Sh0rt!a', 'length'],
    ['lowercase1!', 'upper'],
    ['UPPERCASE1!', 'lower'],
    ['NoNumbers!!', 'number'],
    ['NoSpecial123', 'special'],
  ])('rejects %s because the "%s" rule fails', (password, failingRule) => {
    const rules = ruleMap(password);
    expect(rules[failingRule]).toBe(false);
    expect(isStrongPassword(password)).toBe(false);
    expect(passwordError(password)).toMatch(/Password needs/);
  });

  it('does not count whitespace as a special character', () => {
    expect(ruleMap('Abcdefg 1').special).toBe(false);
  });

  it('reports a missing password', () => {
    expect(passwordError('')).toBe('Password is required.');
    expect(checkPasswordRules(undefined).every((r) => r.met === false)).toBe(true);
  });
});

describe('email validation', () => {
  it.each(['user@example.com', 'alex.chen@university.edu.au', '  padded@example.org  '])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'plainaddress', 'user@', '@example.com', 'user@example', 'user name@example.com'])(
    'rejects "%s"',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );
});

describe('form validators', () => {
  it('validateLogin requires both fields and a valid email', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Email is required.',
      password: 'Password is required.',
    });
    expect(validateLogin({ email: 'nope', password: 'x' })).toEqual({ email: 'Enter a valid email address.' });
    expect(validateLogin({ email: 'a@b.co', password: 'x' })).toEqual({});
  });

  it('validateRegistration checks names, rules and confirmation', () => {
    const errors = validateRegistration({
      firstName: '',
      lastName: 'Chen',
      email: 'alex@uni.edu',
      password: 'Str0ng!Pass',
      confirmPassword: 'Different1!',
    });
    expect(errors).toEqual({ firstName: 'First name is required.', confirmPassword: 'Passwords do not match.' });

    expect(
      validateRegistration({
        firstName: 'Alex',
        lastName: 'Chen',
        email: 'alex@uni.edu',
        password: 'Str0ng!Pass',
        confirmPassword: 'Str0ng!Pass',
      }),
    ).toEqual({});
  });

  it('validatePasswordChange refuses reusing the current password', () => {
    const errors = validatePasswordChange({
      currentPassword: 'Str0ng!Pass',
      newPassword: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
    });
    expect(errors.newPassword).toMatch(/different/);
  });
});

describe('document metadata', () => {
  it('rejects illegal filename characters', () => {
    expect(filenameError('report.pdf')).toBeNull();
    expect(filenameError('bad/name.pdf')).toMatch(/cannot contain/);
    expect(filenameError('   ')).toBe('Filename is required.');
  });

  it('cleans folder segments', () => {
    expect(cleanSegments([' University ', '', '  ', 'Year 2'])).toEqual(['University', 'Year 2']);
  });

  it('requires title, filename, category and a folder', () => {
    const errors = validateDocumentMetadata({ title: '', filename: '', category: '', folder_path: [''] });
    expect(Object.keys(errors).sort()).toEqual(['category', 'filename', 'folder_path', 'title']);
    expect(
      validateDocumentMetadata({ title: 'T', filename: 'a.pdf', category: 'University', folder_path: ['University'] }),
    ).toEqual({});
    expect(validateDocumentMetadata({ title: 'T', filename: 'a.pdf', category: 'X' }, { requireFolder: false })).toEqual(
      {},
    );
  });
});
