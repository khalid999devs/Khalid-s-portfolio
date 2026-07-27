import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { reqs, serverOrigin } from '../axios/requests';

/**
 * Reports a page view, once per route change.
 *
 * Uses `sendBeacon` where available: the browser hands the request to the OS
 * and returns immediately, so nothing about this can delay a render or keep a
 * page alive while it unloads. `fetch` with `keepalive` is the fallback, and a
 * failure is ignored entirely. Analytics must never be why a visitor sees an
 * error.
 *
 * Nothing identifying is sent. The path, a coarse device bucket and the
 * referrer, which the server reduces to a bare host before storing.
 */
const deviceBucket = () => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

export const useVisitTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // The admin panel is not public traffic and counting it would flatter the
    // numbers with my own visits.
    if (location.pathname.startsWith('/admin')) return;

    const url = `${serverOrigin}${reqs.TRACK_VISIT}`;
    const payload = JSON.stringify({
      path: location.pathname,
      device: deviceBucket(),
      referrer: document.referrer || undefined,
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Blocked by an extension, offline, whatever. Not worth a line in the
      // console for a visitor who cannot act on it.
    }
  }, [location.pathname]);
};
