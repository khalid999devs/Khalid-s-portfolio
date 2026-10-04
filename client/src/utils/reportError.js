import { serverOrigin } from '../axios/requests';

const ENDPOINT = `${serverOrigin}/api/client-errors`;
const MAX_REPORTS = 5;
const seen = new Set();

// Fire and forget, like the visit beacon. Reporting must never throw.
export const reportError = (kind, error, location = {}) => {
  try {
    // The admin panel is not public traffic; its failures are already on screen.
    if (import.meta.env.DEV || window.location.pathname.startsWith('/admin')) return;

    const message = String(error?.message || error || '').slice(0, 500);
    const key = `${kind}:${message}`;
    if (!message || seen.has(key) || seen.size >= MAX_REPORTS) return;
    seen.add(key);

    const payload = JSON.stringify({
      kind,
      message,
      stack: String(error?.stack || '').slice(0, 4000),
      source: location.source,
      line: location.line,
      col: location.col,
      path: window.location.pathname,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      build: window.__build,
    });
    navigator.sendBeacon?.(ENDPOINT, new Blob([payload], { type: 'application/json' }));
  } catch {
    // Nothing useful can be done with a failure to report a failure.
  }
};

export const installErrorReporting = () => {
  window.addEventListener('error', (event) => {
    // Resource and cross-origin script errors carry no error object.
    if (!event.error) return;
    reportError('error', event.error, {
      source: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError('unhandledrejection', event.reason);
  });
};
