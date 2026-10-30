import { useState } from 'react';

/**
 * Keyword chips editor. Enter or comma adds a keyword, Backspace on an empty
 * input removes the last one, × removes a specific chip. Duplicates
 * (case-insensitive) are ignored.
 */
export default function TagInput({
  id,
  value = [],
  onChange,
  placeholder = 'Add a keyword and press Enter',
  maxTagLength = 50,
  disabled = false,
  invalid = false,
}) {
  const [draft, setDraft] = useState('');

  const addTags = (raw) => {
    const parts = String(raw)
      .split(',')
      .map((p) => p.trim().slice(0, maxTagLength))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    parts.forEach((part) => {
      if (!next.some((t) => t.toLowerCase() === part.toLowerCase())) next.push(part);
    });
    if (next.length !== value.length) onChange(next);
  };

  const removeAt = (index) => onChange(value.filter((_, i) => i !== index));

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTags(draft);
      setDraft('');
    } else if (event.key === 'Backspace' && !draft && value.length) {
      removeAt(value.length - 1);
    }
  };

  const handleChange = (event) => {
    const text = event.target.value;
    // Pasting "a, b, c" adds all three at once.
    if (text.includes(',')) {
      addTags(text);
      setDraft('');
    } else {
      setDraft(text);
    }
  };

  return (
    <div className={`fa-tag-input form-control d-flex flex-wrap align-items-center gap-2 ${invalid ? 'is-invalid' : ''} ${disabled ? 'disabled' : ''}`}>
      {value.map((tag, index) => (
        <span key={`${tag}-${index}`} className="fa-chip">
          <span className="fa-chip-hash" aria-hidden="true">#</span>
          {tag}
          {!disabled && (
            <button
              type="button"
              className="fa-chip-remove"
              onClick={() => removeAt(index)}
              aria-label={`Remove keyword ${tag}`}
            >
              <i className="bi bi-x" aria-hidden="true" />
            </button>
          )}
        </span>
      ))}
      <input
        id={id}
        type="text"
        className="fa-tag-input-field flex-grow-1"
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) {
            addTags(draft);
            setDraft('');
          }
        }}
        placeholder={value.length ? '' : placeholder}
        aria-label="Add keyword"
        disabled={disabled}
      />
    </div>
  );
}
