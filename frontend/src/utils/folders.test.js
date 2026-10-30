import { describe, expect, it } from 'vitest';
import { ancestorIds, childNamesAt, displayPath, findFolderById, flattenFolders, joinPath, splitPath } from './folders';

const tree = [
  {
    folder_id: 1,
    name: 'University',
    parent_folder_id: null,
    path: 'University',
    document_count: 3,
    children: [
      {
        folder_id: 2,
        name: 'Year 2',
        parent_folder_id: 1,
        path: 'University/Year 2',
        document_count: 2,
        children: [{ folder_id: 4, name: 'Semester 1', parent_folder_id: 2, document_count: 1, children: [] }],
      },
    ],
  },
  { folder_id: 3, name: 'Finance', parent_folder_id: null, path: 'Finance', document_count: 5, children: [] },
];

describe('folder helpers', () => {
  it('splits and joins paths', () => {
    expect(splitPath('University/Year 2/')).toEqual(['University', 'Year 2']);
    expect(splitPath(null)).toEqual([]);
    expect(joinPath([' University ', '', 'Year 2'])).toBe('University/Year 2');
    expect(displayPath('University/Year 2')).toBe('University / Year 2');
    expect(displayPath(null)).toBe('Not filed');
  });

  it('flattens the tree depth-first and fills in missing paths', () => {
    const flat = flattenFolders(tree);
    expect(flat.map((f) => f.path)).toEqual([
      'University',
      'University/Year 2',
      'University/Year 2/Semester 1',
      'Finance',
    ]);
    expect(flat.map((f) => f.depth)).toEqual([0, 1, 2, 0]);
    expect(flat[0].hasChildren).toBe(true);
  });

  it('finds folders and ancestors', () => {
    expect(findFolderById(tree, 4).name).toBe('Semester 1');
    expect(findFolderById(tree, 99)).toBeNull();
    expect(ancestorIds(tree, 4)).toEqual([1, 2]);
    expect(ancestorIds(tree, 3)).toEqual([]);
  });

  it('suggests child folder names for a partial path (case-insensitive)', () => {
    expect(childNamesAt(tree, [])).toEqual(['University', 'Finance']);
    expect(childNamesAt(tree, ['university'])).toEqual(['Year 2']);
    expect(childNamesAt(tree, ['Nope'])).toEqual([]);
  });
});
