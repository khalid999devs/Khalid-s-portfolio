import { reportError } from './reportError';

// Shared with the boot script in index.html, so both count as one reload.
const RELOAD_KEY = 'reload-at';
const RELOAD_WINDOW_MS = 30000;

let optional = 0;

// For an import whose failure the caller handles; it must not reload the page.
export const optionalImport = (load) => {
  optional += 1;
  return load().finally(() => {
    optional -= 1;
  });
};

const reloadOnce = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};

// A lazy chunk that fails to download gets one reload before the error page.
export const installChunkRecovery = () => {
  window.addEventListener('vite:preloadError', (event) => {
    if (optional > 0) return;
    reportError('chunk', event.payload);
    if (reloadOnce()) event.preventDefault();
  });
};
