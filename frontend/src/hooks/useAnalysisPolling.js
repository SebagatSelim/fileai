// Polls GET /api/documents/{id}/analysis every `intervalMs` until the status is
// terminal (AWAITING_REVIEW, STORED or FAILED). Used by the upload queue and
// the review page.
import { useCallback, useEffect, useState } from 'react';
import { getAnalysis } from '../api/documents';
import { getApiError } from '../api/client';
import { isTerminalStatus } from '../utils/labels';

const MAX_CONSECUTIVE_FAILURES = 5;

export default function useAnalysisPolling(fileId, { enabled = true, intervalMs = 2000 } = {}) {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(fileId && enabled));
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!fileId || !enabled) return undefined;
    let cancelled = false;
    let timer = null;
    let failures = 0;

    const poll = async () => {
      try {
        const data = await getAnalysis(fileId);
        if (cancelled) return;
        failures = 0;
        setAnalysis(data);
        setError(null);
        setLoading(false);
        if (!isTerminalStatus(data?.status)) timer = window.setTimeout(poll, intervalMs);
      } catch (err) {
        if (cancelled) return;
        failures += 1;
        const apiError = getApiError(err);
        const fatal = [401, 403, 404].includes(apiError.status);
        if (fatal || failures >= MAX_CONSECUTIVE_FAILURES) {
          setError(apiError);
          setLoading(false);
        } else {
          timer = window.setTimeout(poll, intervalMs);
        }
      }
    };

    setLoading(true);
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [fileId, enabled, intervalMs, runId]);

  /** Start polling again (e.g. after POST /reprocess). */
  const restart = useCallback(() => {
    setError(null);
    setRunId((n) => n + 1);
  }, []);

  return { analysis, setAnalysis, error, loading, restart };
}
