const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const getReducedMotionMediaQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY)
    : null;

export const prefersReducedMotion = () =>
  getReducedMotionMediaQuery()?.matches || false;
