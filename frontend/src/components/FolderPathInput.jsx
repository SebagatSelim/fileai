import { useId, useMemo, useState } from 'react';
import { childNamesAt, flattenFolders, joinPath } from '../utils/folders';

/**
 * Editable folder path (FR-05): one text input per segment with add/remove,
 * per-level autocomplete from the existing folder tree, plus a quick picker
 * for any existing folder path.
 *
 * `value` is an array of segments, e.g. ["University", "Year 2"].
 */
export default function FolderPathInput({ id, value = [], onChange, folders = [], invalid = false, disabled = false }) {
  const baseId = useId();
  const [pick, setPick] = useState('');
  const segments = value.length ? value : [''];
  const flat = useMemo(() => flattenFolders(folders), [folders]);

  const update = (index, text) => {
    const next = [...segments];
    next[index] = text;
    onChange(next);
  };

  const removeAt = (index) => {
    const next = segments.filter((_, i) => i !== index);
    onChange(next.length ? next : ['']);
  };

  const addLevel = () => onChange([...segments, '']);

  const handlePick = (event) => {
    const text = event.target.value;
    setPick(text);
    const match = flat.find((f) => f.path.toLowerCase() === text.trim().toLowerCase());
    if (match) {
      onChange(match.path.split('/'));
      setPick('');
    }
  };

  const cleanPath = joinPath(segments);
  const exists = cleanPath && flat.some((f) => f.path.toLowerCase() === cleanPath.toLowerCase());

  return (
    <div className={`fa-folder-path ${invalid ? 'is-invalid' : ''}`}>
      {flat.length > 0 && (
        <div className="input-group input-group-sm mb-2">
          <span className="input-group-text bg-white">
            <i className="bi bi-folder2-open" aria-hidden="true" />
          </span>
          <input
            type="text"
            className="form-control"
            list={`${baseId}-all`}
            value={pick}
            onChange={handlePick}
            placeholder="Pick an existing folder…"
            aria-label="Pick an existing folder"
            disabled={disabled}
          />
          <datalist id={`${baseId}-all`}>
            {flat.map((f) => (
              <option key={f.folder_id} value={f.path} />
            ))}
          </datalist>
        </div>
      )}

      <div className="fa-folder-segments d-flex flex-wrap align-items-center gap-1">
        {segments.map((segment, index) => {
          const suggestions = childNamesAt(folders, segments.slice(0, index));
          const listId = `${baseId}-seg-${index}`;
          return (
            <div key={index} className="d-flex align-items-center gap-1">
              {index > 0 && <i className="bi bi-chevron-right text-muted small" aria-hidden="true" />}
              <div className="fa-folder-segment input-group input-group-sm">
                <input
                  id={index === 0 ? id : undefined}
                  type="text"
                  className={`form-control ${invalid && !segment.trim() ? 'is-invalid' : ''}`}
                  value={segment}
                  onChange={(e) => update(index, e.target.value.replace(/[\\/]/g, ''))}
                  list={suggestions.length ? listId : undefined}
                  placeholder={index === 0 ? 'Top-level folder' : 'Sub-folder'}
                  aria-label={`Folder level ${index + 1}`}
                  disabled={disabled}
                  size={Math.max(index === 0 ? 16 : 11, Math.min(32, segment.length + 2))}
                />
                {suggestions.length > 0 && (
                  <datalist id={listId}>
                    {suggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                )}
                {(segments.length > 1 || segment) && !disabled && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => removeAt(index)}
                    aria-label={`Remove folder level ${index + 1}`}
                    title="Remove this level"
                  >
                    <i className="bi bi-x" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!disabled && (
          <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={addLevel}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Add level
          </button>
        )}
      </div>

      {cleanPath && (
        <div className="small mt-2 d-flex align-items-center gap-2 text-muted">
          <i className="bi bi-folder2" aria-hidden="true" />
          <span className="text-body">{cleanPath.split('/').join(' / ')}</span>
          {exists ? (
            <span className="badge rounded-pill text-bg-light border">Existing folder</span>
          ) : (
            <span className="badge rounded-pill fa-badge-new">New folders will be created</span>
          )}
        </div>
      )}
    </div>
  );
}
