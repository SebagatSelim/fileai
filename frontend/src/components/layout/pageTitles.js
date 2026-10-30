import { matchPath } from 'react-router-dom';

// Order matters: more specific patterns first.
const PAGE_TITLES = [
  ['/documents/:id/review', 'AI Analysis & Metadata'],
  ['/documents/:id', 'Document Details'],
  ['/documents', 'Documents'],
  ['/upload', 'Upload Files'],
  ['/search', 'AI Search'],
  ['/review', 'Review Queue'],
  ['/folders', 'All Folders'],
  ['/categories', 'Categories'],
  ['/settings', 'Profile & Settings'],
  ['/', 'Dashboard'],
];

export function getPageTitle(pathname) {
  const match = PAGE_TITLES.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  return match ? match[1] : 'FileAI';
}
