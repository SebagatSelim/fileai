// Server capabilities from GET /api/health (upload limit, allowed types,
// low-confidence threshold, AI providers). Sensible defaults are used until
// (or if) the request succeeds, so the UI never blocks on it.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getHealth } from '../api/health';
import { getApiError } from '../api/client';
import { DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_MAX_UPLOAD_MB } from '../utils/fileTypes';

export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.6;

export const DEFAULT_CONFIG = {
  status: 'unknown',
  ai_provider: null,
  embedding_provider: null,
  ocr_available: null,
  storage_backend: null,
  max_upload_mb: DEFAULT_MAX_UPLOAD_MB,
  low_confidence_threshold: DEFAULT_LOW_CONFIDENCE_THRESHOLD,
  allowed_extensions: DEFAULT_ALLOWED_EXTENSIONS,
};

/** Merge the health response over the defaults, ignoring invalid values. */
export function normaliseConfig(data = {}) {
  const config = { ...DEFAULT_CONFIG, ...data };
  const maxMb = Number(data.max_upload_mb);
  config.max_upload_mb = Number.isFinite(maxMb) && maxMb > 0 ? maxMb : DEFAULT_MAX_UPLOAD_MB;
  const threshold = Number(data.low_confidence_threshold);
  config.low_confidence_threshold =
    Number.isFinite(threshold) && threshold >= 0 && threshold <= 1 ? threshold : DEFAULT_LOW_CONFIDENCE_THRESHOLD;
  config.allowed_extensions =
    Array.isArray(data.allowed_extensions) && data.allowed_extensions.length
      ? data.allowed_extensions.map((e) => String(e).toLowerCase().replace(/^\./, ''))
      : DEFAULT_ALLOWED_EXTENSIONS;
  return config;
}

const AppConfigContext = createContext({ config: DEFAULT_CONFIG, loading: false, error: null, reload: () => {} });

export function AppConfigProvider({ children }) {
  const [state, setState] = useState({ config: DEFAULT_CONFIG, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await getHealth();
      setState({ config: normaliseConfig(data), loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: getApiError(err) }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => ({ ...state, reload }), [state, reload]);
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
