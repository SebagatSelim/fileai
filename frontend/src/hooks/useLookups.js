// Loads the user's categories and folder tree for autocomplete lists.
// Failures are non-fatal: the inputs still accept free text.
import { useCallback, useEffect, useState } from 'react';
import { getCategories } from '../api/categories';
import { getFolders } from '../api/folders';

async function fetchLookups() {
  const [categoriesResult, foldersResult] = await Promise.allSettled([getCategories(), getFolders()]);
  const categoryCounts = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
  return {
    categoryCounts,
    categories: categoryCounts.map((c) => c.category).filter(Boolean),
    folders: foldersResult.status === 'fulfilled' ? foldersResult.value : [],
    loading: false,
  };
}

export default function useLookups() {
  const [state, setState] = useState({ categories: [], categoryCounts: [], folders: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    fetchLookups().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setState(await fetchLookups());
  }, []);

  return { ...state, reload };
}
