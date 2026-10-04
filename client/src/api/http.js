import { serverOrigin } from '../axios/requests';

export class HttpError extends Error {
  constructor(status, data) {
    super(data?.msg || `Request failed with status ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

// What the public pages used axios for: JSON out, JSON back, reject on a non-2xx.
// `onResponse` fires when the response arrives, before its body is read.
export const request = async (path, { method = 'GET', body, onResponse } = {}) => {
  const response = await fetch(`${serverOrigin}${path}`, {
    method,
    // Same as axios.defaults.withCredentials in axios/global.js.
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  onResponse?.();

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new HttpError(response.status, data);
  return data;
};
