import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import api, { TOKEN_KEY, USER_KEY, getApiError, saveSession, setUnauthorizedHandler } from './client';

/** Axios adapter that fails with the given HTTP status and body. */
function failingAdapter(status, data) {
  return async (config) => {
    const response = { status, data, headers: {}, config, statusText: String(status) };
    throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, response);
  };
}

/** Adapter that records the request config and succeeds. */
function recordingAdapter(seen) {
  return async (config) => {
    seen.push(config);
    return { status: 200, data: { ok: true }, headers: {}, config, statusText: 'OK' };
  };
}

describe('api client', () => {
  afterEach(() => setUnauthorizedHandler(null));

  it('uses /api as the base URL and attaches the bearer token', async () => {
    saveSession({ token: 'abc', user: { name: 'A' }, expiresIn: 60 });
    const seen = [];
    await api.get('/documents', { adapter: recordingAdapter(seen) });
    expect(seen[0].baseURL).toBe('/api');
    expect(seen[0].headers.Authorization).toBe('Bearer abc');
  });

  it('clears the session and calls the 401 handler for protected calls', async () => {
    saveSession({ token: 'expired', user: { name: 'A' } });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(
      api.get('/dashboard/stats', { adapter: failingAdapter(401, { error: { code: 'UNAUTHORIZED', message: 'Token expired' } }) }),
    ).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(USER_KEY)).toBeNull();
  });

  it('does not log out when a call opts out (e.g. wrong current password)', async () => {
    saveSession({ token: 'valid', user: { name: 'A' } });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(
      api.put('/users/me/password', {}, { skipAuthRedirect: true, adapter: failingAdapter(401, {}) }),
    ).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('valid');
  });

  it('normalises API errors', async () => {
    const error = await api
      .post('/documents', null, {
        adapter: failingAdapter(409, {
          error: {
            code: 'DUPLICATE_FILE',
            message: 'You already have this file.',
            existing_file: { file_id: 233, name: 'Database_Assignment.pdf', folder_path: 'University/Year 2' },
          },
        }),
      })
      .catch((e) => e);
    const normalised = getApiError(error);
    expect(normalised).toMatchObject({ status: 409, code: 'DUPLICATE_FILE', message: 'You already have this file.' });
    expect(normalised.details.existing_file.file_id).toBe(233);
  });

  it('gives a friendly message for network errors and bare HTTP errors', () => {
    expect(getApiError(new AxiosError('Network Error', 'ERR_NETWORK')).code).toBe('NETWORK_ERROR');
    const bare = getApiError({ response: { status: 413, data: '<html>Too large</html>' } });
    expect(bare).toMatchObject({ status: 413, code: 'HTTP_413', message: 'The file is too large to upload.' });
  });
});
