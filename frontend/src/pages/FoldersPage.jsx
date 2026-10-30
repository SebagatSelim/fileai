import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { CategoryBadge, FileIcon } from '../components/Badges';
import { EmptyState, ErrorState, SkeletonList } from '../components/Feedback';
import { createFolder, getFolders } from '../api/folders';
import { listDocuments } from '../api/documents';
import { getApiError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatBytes, formatDate, formatNumber, plural } from '../utils/format';
import { ancestorIds, findFolderById, flattenFolders } from '../utils/folders';
import { folderSegmentError } from '../utils/validation';

const PER_PAGE = 20;

function FolderNode({ node, depth, expanded, onToggle, selectedId, onSelect }) {
  const id = String(node.folder_id);
  const hasChildren = Boolean(node.children && node.children.length);
  const isOpen = expanded.has(id);
  const isSelected = id === String(selectedId);
  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={isSelected}>
      <div className={`fa-tree-row ${isSelected ? 'active' : ''}`} style={{ paddingLeft: 6 + depth * 18 }}>
        {hasChildren ? (
          <button
            type="button"
            className="fa-tree-toggle"
            onClick={() => onToggle(id)}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
          >
            <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden="true" />
          </button>
        ) : (
          <span className="fa-tree-toggle" aria-hidden="true" />
        )}
        <button type="button" className="fa-tree-label" onClick={() => onSelect(node)}>
          <i className={`bi ${isSelected || isOpen ? 'bi-folder2-open' : 'bi-folder2'} fa-folder-icon`} aria-hidden="true" />
          <span className="text-truncate flex-grow-1 text-start">{node.name}</span>
          <span className="fa-tree-count" title={`${node.document_count ?? 0} documents`}>
            {formatNumber(node.document_count ?? 0)}
          </span>
        </button>
      </div>
      {hasChildren && isOpen && (
        <ul role="group" className="list-unstyled mb-0">
          {node.children.map((child) => (
            <FolderNode
              key={child.folder_id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function FolderTiles({ folders, onSelect }) {
  if (!folders.length) return null;
  return (
    <div className="row g-2 mb-3">
      {folders.map((folder) => (
        <div key={folder.folder_id} className="col-sm-6 col-xxl-4">
          <button type="button" className="fa-folder-tile w-100" onClick={() => onSelect(folder)}>
            <i className="bi bi-folder-fill fa-folder-icon fs-4" aria-hidden="true" />
            <span className="min-w-0 text-start flex-grow-1">
              <span className="fw-semibold d-block text-truncate">{folder.name}</span>
              <span className="small text-muted">
                {plural(folder.document_count ?? 0, 'doc')}
                {folder.children?.length ? ` · ${plural(folder.children.length, 'folder')}` : ''}
              </span>
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

export default function FoldersPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('folder') || '';

  const [tree, setTree] = useState({ loading: true, error: null, data: [] });
  const [expanded, setExpanded] = useState(() => new Set());
  const [docs, setDocs] = useState({ loading: false, error: null, data: null });
  const [page, setPage] = useState(1);
  const [docsReload, setDocsReload] = useState(0);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState('');
  const [newError, setNewError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTree = useCallback(async () => {
    setTree((t) => ({ ...t, loading: true, error: null }));
    try {
      const data = await getFolders();
      setTree({ loading: false, error: null, data });
      return data;
    } catch (err) {
      setTree((t) => ({ ...t, loading: false, error: getApiError(err) }));
      return null;
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const flat = useMemo(() => flattenFolders(tree.data), [tree.data]);
  const selected = useMemo(() => (selectedId ? findFolderById(tree.data, selectedId) : null), [tree.data, selectedId]);
  const selectedPath = flat.find((f) => String(f.folder_id) === String(selectedId))?.path;

  // Make sure the selected folder is visible in the tree.
  const [expandedFor, setExpandedFor] = useState(null);
  if (selected && expandedFor !== selectedId) {
    setExpandedFor(selectedId);
    const ancestors = ancestorIds(tree.data, selectedId) || [];
    if (ancestors.some((a) => !expanded.has(String(a)))) {
      setExpanded((prev) => new Set([...prev, ...ancestors.map(String)]));
    }
  }

  // Reset paging when switching folders.
  const [pageFor, setPageFor] = useState(selectedId);
  if (pageFor !== selectedId) {
    setPageFor(selectedId);
    setPage(1);
  }

  useEffect(() => {
    if (!selectedId) {
      setDocs({ loading: false, error: null, data: null });
      return undefined;
    }
    let cancelled = false;
    setDocs((d) => ({ ...d, loading: true, error: null }));
    listDocuments({ folder_id: selectedId, page, per_page: PER_PAGE, sort: 'uploaded_at', order: 'desc' })
      .then((data) => {
        if (!cancelled) setDocs({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (!cancelled) setDocs({ loading: false, error: getApiError(err), data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, page, docsReload]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const select = (folder) => setParams(folder ? { folder: String(folder.folder_id) } : {});
  const expandAll = () => setExpanded(new Set(flat.filter((f) => f.hasChildren).map((f) => String(f.folder_id))));
  const collapseAll = () => setExpanded(new Set());

  const openNewFolder = () => {
    setNewName('');
    setNewParent(selectedId || '');
    setNewError('');
    setNewOpen(true);
  };

  const submitNewFolder = async (event) => {
    event.preventDefault();
    const error = folderSegmentError(newName);
    if (error) {
      setNewError(error);
      return;
    }
    setCreating(true);
    try {
      const folder = await createFolder({ name: newName.trim(), parentFolderId: newParent ? Number(newParent) : null });
      toast.success(`Folder “${newName.trim()}” created.`);
      setNewOpen(false);
      await loadTree();
      if (newParent) setExpanded((prev) => new Set([...prev, String(newParent)]));
      if (folder?.folder_id) select(folder);
    } catch (err) {
      const apiError = getApiError(err);
      setNewError(
        apiError.code === 'FOLDER_EXISTS' || apiError.status === 409
          ? apiError.details.message || 'A folder with this name already exists here.'
          : apiError.fields.name || apiError.message,
      );
    } finally {
      setCreating(false);
    }
  };

  const items = docs.data?.items || [];

  return (
    <div className="fa-page">
      <div className="row g-4">
        <div className="col-lg-5 col-xl-4">
          <div className="card fa-card fa-sticky">
            <div className="card-header fa-card-header">
              <h2 className="fa-card-title mb-0">Folders</h2>
              <button type="button" className="btn btn-sm btn-primary" onClick={openNewFolder}>
                <i className="bi bi-folder-plus me-1" aria-hidden="true" />
                New folder
              </button>
            </div>
            <div className="card-body p-2">
              {tree.loading && !tree.data.length && <SkeletonList rows={5} className="p-2" />}
              {!tree.loading && tree.error && (
                <ErrorState compact title="Couldn't load folders" message={tree.error.message} onRetry={loadTree} />
              )}
              {!tree.error && !tree.loading && !tree.data.length && (
                <EmptyState compact icon="bi-folder2" title="No folders yet">
                  Folders are created when you approve a document, or you can add one now.
                </EmptyState>
              )}
              {tree.data.length > 0 && (
                <>
                  <div className="d-flex justify-content-between align-items-center px-2 pb-2 small text-nowrap">
                    <button type="button" className={`btn btn-link btn-sm p-0 text-decoration-none ${!selectedId ? 'fw-semibold' : ''}`} onClick={() => select(null)}>
                      <i className="bi bi-house me-1" aria-hidden="true" />
                      All folders
                    </button>
                    <span className="ms-2">
                      <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none me-2" onClick={expandAll}>
                        Expand
                      </button>
                      <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={collapseAll}>
                        Collapse
                      </button>
                    </span>
                  </div>
                  <ul role="tree" aria-label="Folder tree" className="list-unstyled mb-0 fa-tree">
                    {tree.data.map((node) => (
                      <FolderNode
                        key={node.folder_id}
                        node={node}
                        depth={0}
                        expanded={expanded}
                        onToggle={toggle}
                        selectedId={selectedId}
                        onSelect={select}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-7 col-xl-8">
          {!selectedId && (
            <div className="card fa-card">
              <div className="card-header fa-card-header">
                <div>
                  <h2 className="fa-card-title mb-0">All folders</h2>
                  <div className="fa-card-subtitle">
                    {plural(flat.length, 'folder')} · choose one to see its documents
                  </div>
                </div>
              </div>
              <div className="card-body">
                {tree.data.length ? (
                  <FolderTiles folders={tree.data} onSelect={select} />
                ) : (
                  !tree.loading && (
                    <EmptyState icon="bi-folder2-open" title="Nothing here yet">
                      Upload and approve a document and FileAI will create folders such as University / Year 2 for
                      you.
                    </EmptyState>
                  )
                )}
              </div>
            </div>
          )}

          {selectedId && !tree.loading && !selected && !tree.error && (
            <div className="card fa-card">
              <EmptyState
                icon="bi-folder-x"
                title="Folder not found"
                action={
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => select(null)}>
                    Show all folders
                  </button>
                }
              >
                It may have been removed.
              </EmptyState>
            </div>
          )}

          {selected && (
            <div className="card fa-card">
              <div className="card-header fa-card-header flex-wrap">
                <div className="min-w-0">
                  <h2 className="fa-card-title mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-folder2-open fa-folder-icon" aria-hidden="true" />
                    <span className="text-truncate">{selected.name}</span>
                  </h2>
                  <div className="fa-card-subtitle text-truncate">{(selectedPath || selected.name).split('/').join(' / ')}</div>
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-sm btn-light" onClick={openNewFolder}>
                    <i className="bi bi-folder-plus me-1" aria-hidden="true" />
                    New subfolder
                  </button>
                  <Link to={`/documents?folder_id=${selected.folder_id}`} className="btn btn-sm btn-light">
                    Open in Documents
                  </Link>
                </div>
              </div>
              <div className="card-body">
                <FolderTiles folders={selected.children || []} onSelect={select} />

                {docs.loading && !docs.data && <SkeletonList rows={4} />}
                {!docs.loading && docs.error && (
                  <ErrorState
                    compact
                    title="Couldn't load documents"
                    message={docs.error.message}
                    onRetry={() => setDocsReload((n) => n + 1)}
                  />
                )}
                {!docs.error && docs.data && !items.length && (
                  <EmptyState compact icon="bi-file-earmark" title="No documents in this folder">
                    {selected.children?.length ? 'Open a subfolder above to see more.' : 'Approved uploads filed here will appear in this list.'}
                  </EmptyState>
                )}
                {items.length > 0 && (
                  <ul className={`list-unstyled mb-0 fa-doc-list ${docs.loading ? 'fa-loading-dim' : ''}`}>
                    {items.map((doc) => (
                      <li key={doc.file_id}>
                        <Link to={`/documents/${doc.file_id}`} className="fa-doc-row">
                          <FileIcon type={doc.file_type} name={doc.name} size={38} />
                          <span className="min-w-0 flex-grow-1">
                            <span className="fw-semibold d-block text-truncate text-body">{doc.title || doc.name}</span>
                            <span className="small text-muted d-block text-truncate">{doc.name}</span>
                          </span>
                          <span className="d-none d-md-inline">
                            <CategoryBadge category={doc.category} />
                          </span>
                          <span className="small text-muted text-nowrap d-none d-sm-inline">
                            {formatDate(doc.uploaded_at)} · {formatBytes(doc.file_size_bytes)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {docs.data && (
                  <Pagination
                    className="mt-3"
                    page={docs.data.page || page}
                    perPage={docs.data.per_page || PER_PAGE}
                    total={docs.data.total || 0}
                    onChange={setPage}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        show={newOpen}
        title="New folder"
        icon="bi-folder-plus"
        iconTone="amber"
        onClose={() => !creating && setNewOpen(false)}
        closeDisabled={creating}
      >
        <form onSubmit={submitNewFolder} noValidate>
          <div className="mb-3">
            <label htmlFor="new-folder-name" className="form-label fa-label">
              Folder name
            </label>
            <input
              id="new-folder-name"
              type="text"
              className={`form-control ${newError ? 'is-invalid' : ''}`}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewError('');
              }}
              placeholder="e.g. Semester 1"
              maxLength={100}
            />
            {newError && <div className="invalid-feedback">{newError}</div>}
          </div>
          <div className="mb-2">
            <label htmlFor="new-folder-parent" className="form-label fa-label">
              Inside
            </label>
            <select
              id="new-folder-parent"
              className="form-select"
              value={newParent}
              onChange={(e) => setNewParent(e.target.value)}
            >
              <option value="">Top level</option>
              {flat.map((f) => (
                <option key={f.folder_id} value={f.folder_id}>
                  {f.path.split('/').join(' / ')}
                </option>
              ))}
            </select>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-4">
            <button type="button" className="btn btn-light" onClick={() => setNewOpen(false)} disabled={creating}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              Create folder
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
