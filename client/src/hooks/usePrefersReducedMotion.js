import { useEffect, useState } from 'react';
import { getReducedMotionMediaQuery } from '../utils/motionPreferences';

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => getReducedMotionMediaQuery()?.matches || false
  );

  useEffect(() => {
    const mediaQuery = getReducedMotionMediaQuery();
    if (!mediaQuery) return undefined;

    const handleChange = (event) => setPrefersReducedMotion(event.matches);
    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

export default usePrefersReducedMotion;
