import { useId } from 'react';
import FolderPathInput from './FolderPathInput';
import TagInput from './TagInput';

/**
 * Editable document metadata (FR-04 / FR-05) shared by the review page and the
 * "Edit metadata" form on the document details page.
 *
 * values: { title, filename, category, subject, document_type, keywords[], summary, folder_path[] }
 */
export default function MetadataFields({
  values,
  onChange,
  errors = {},
  categories = [],
  folders = [],
  showFolder = true,
  disabled = false,
  aiHints = false,
}) {
  const base = useId();
  const fid = (name) => `${base}-${name}`;
  const categoryListId = `${base}-categories`;
  const set = (name) => (event) => onChange(name, event.target.value);
  const aiBadge = aiHints ? (
    <span className="fa-ai-hint" title="Suggested by AI">
      <i className="bi bi-stars" aria-hidden="true" /> AI
    </span>
  ) : null;

  const errorFor = (name) =>
    errors[name] ? (
      <div id={`${fid(name)}-error`} className="invalid-feedback d-block">
        {errors[name]}
      </div>
    ) : null;

  const inputProps = (name) => ({
    id: fid(name),
    className: `form-control ${errors[name] ? 'is-invalid' : ''}`,
    value: values[name] ?? '',
    onChange: set(name),
    disabled,
    'aria-invalid': Boolean(errors[name]) || undefined,
    'aria-describedby': errors[name] ? `${fid(name)}-error` : undefined,
  });

  return (
    <div className="row g-3">
      <div className="col-12">
        <label htmlFor={fid('title')} className="form-label fa-label">
          Title {aiBadge}
        </label>
        <input type="text" {...inputProps('title')} placeholder="Document title" maxLength={255} />
        {errorFor('title')}
      </div>

      <div className="col-md-7">
        <label htmlFor={fid('filename')} className="form-label fa-label">
          Filename {aiBadge}
        </label>
        <div className="input-group">
          <span className="input-group-text bg-white">
            <i className="bi bi-file-earmark" aria-hidden="true" />
          </span>
          <input type="text" {...inputProps('filename')} placeholder="My_Document.pdf" maxLength={255} />
        </div>
        {errorFor('filename')}
      </div>

      <div className="col-md-5">
        <label htmlFor={fid('category')} className="form-label fa-label">
          Category {aiBadge}
        </label>
        <input type="text" {...inputProps('category')} list={categoryListId} placeholder="e.g. University" maxLength={100} />
        <datalist id={categoryListId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {errorFor('category')}
      </div>

      <div className="col-md-6">
        <label htmlFor={fid('subject')} className="form-label fa-label">
          Subject <span className="text-muted fw-normal">(optional)</span>
        </label>
        <input type="text" {...inputProps('subject')} placeholder="e.g. Database Systems" maxLength={150} />
        {errorFor('subject')}
      </div>

      <div className="col-md-6">
        <label htmlFor={fid('document_type')} className="form-label fa-label">
          Document type <span className="text-muted fw-normal">(optional)</span>
        </label>
        <input type="text" {...inputProps('document_type')} placeholder="e.g. Assignment, Invoice" maxLength={100} />
        {errorFor('document_type')}
      </div>

      {showFolder && (
        <div className="col-12">
          <label htmlFor={fid('folder_path')} className="form-label fa-label">
            Folder {aiBadge}
          </label>
          <FolderPathInput
            id={fid('folder_path')}
            value={values.folder_path || []}
            onChange={(segments) => onChange('folder_path', segments)}
            folders={folders}
            invalid={Boolean(errors.folder_path)}
            disabled={disabled}
          />
          {errorFor('folder_path')}
        </div>
      )}

      <div className="col-12">
        <label htmlFor={fid('keywords')} className="form-label fa-label">
          Keywords {aiBadge}
        </label>
        <TagInput
          id={fid('keywords')}
          value={values.keywords || []}
          onChange={(keywords) => onChange('keywords', keywords)}
          disabled={disabled}
          invalid={Boolean(errors.keywords)}
        />
        <div className="form-text">Press Enter or comma to add. Backspace removes the last keyword.</div>
        {errorFor('keywords')}
      </div>

      <div className="col-12">
        <label htmlFor={fid('summary')} className="form-label fa-label">
          Summary {aiBadge}
        </label>
        <textarea {...inputProps('summary')} rows={4} placeholder="A short description of the document" />
        {errorFor('summary')}
      </div>
    </div>
  );
}

/** Map API `fields` keys onto form fields (they already match the contract names). */
export function mapApiFieldErrors(fields = {}) {
  const mapped = {};
  Object.entries(fields).forEach(([key, message]) => {
    const name = key === 'name' ? 'filename' : key;
    mapped[name] = Array.isArray(message) ? message.join(' ') : String(message);
  });
  return mapped;
}
