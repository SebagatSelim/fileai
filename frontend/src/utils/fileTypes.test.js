import { describe, expect, it } from 'vitest';
import {
  buildAcceptMap,
  fileTypeIcon,
  getExtension,
  isInlinePreviewable,
  normaliseFileType,
  validateUploadFile,
} from './fileTypes';

const fakeFile = (name, size = 1000) => ({ name, size });

describe('fileTypeIcon', () => {
  it.each([
    ['PDF', 'bi-file-earmark-pdf'],
    ['DOCX', 'bi-file-earmark-word'],
    ['TXT', 'bi-file-earmark-text'],
    ['PNG', 'bi-file-earmark-image'],
    ['JPG', 'bi-file-earmark-image'],
    ['holiday.jpeg', 'bi-file-earmark-image'],
    ['Report.Final.PDF', 'bi-file-earmark-pdf'],
    ['archive.zip', 'bi-file-earmark'],
    [null, 'bi-file-earmark'],
  ])('%s -> %s', (input, icon) => {
    expect(fileTypeIcon(input)).toBe(icon);
  });
});

describe('file type helpers', () => {
  it('extracts extensions', () => {
    expect(getExtension('a/b/Notes.TXT')).toBe('txt');
    expect(getExtension('.env')).toBe('');
    expect(getExtension('noext')).toBe('');
  });

  it('normalises types', () => {
    expect(normaliseFileType('jpeg')).toBe('JPG');
    expect(normaliseFileType('photo.jpeg')).toBe('JPG');
    expect(normaliseFileType('docx')).toBe('DOCX');
    expect(normaliseFileType('exe')).toBe('');
  });

  it('knows which types preview inline', () => {
    expect(isInlinePreviewable('PDF')).toBe(true);
    expect(isInlinePreviewable('PNG')).toBe(true);
    expect(isInlinePreviewable('DOCX')).toBe(false);
    expect(isInlinePreviewable('TXT')).toBe(false);
  });

  it('builds a react-dropzone accept map', () => {
    const accept = buildAcceptMap(['pdf', 'jpg', 'jpeg']);
    expect(accept['application/pdf']).toEqual(['.pdf']);
    expect(accept['image/jpeg']).toEqual(['.jpg', '.jpeg']);
  });
});

describe('validateUploadFile (FR-02)', () => {
  it('accepts supported files under the limit', () => {
    expect(validateUploadFile(fakeFile('assignment.pdf'))).toBeNull();
    expect(validateUploadFile(fakeFile('scan.JPEG'))).toBeNull();
  });

  it('rejects unsupported types', () => {
    expect(validateUploadFile(fakeFile('virus.exe'))).toMatch(/Unsupported file type \(\.exe\)/);
    expect(validateUploadFile(fakeFile('README'))).toMatch(/Unsupported file type/);
  });

  it('rejects empty and oversized files', () => {
    expect(validateUploadFile(fakeFile('empty.txt', 0))).toMatch(/empty/);
    expect(validateUploadFile(fakeFile('big.pdf', 21 * 1024 * 1024), { maxUploadMb: 20 })).toMatch(/20 MB/);
    expect(validateUploadFile(fakeFile('ok.pdf', 19 * 1024 * 1024), { maxUploadMb: 20 })).toBeNull();
  });

  it('uses the server-provided extension list', () => {
    expect(validateUploadFile(fakeFile('notes.txt'), { allowedExtensions: ['pdf'] })).toMatch(/Allowed: \.pdf/);
  });
});
