import { useState, useEffect } from 'react';

const useIsGreaterOrEqualMd = () => {
  const [isGreaterOrEqualMd, setIsGreaterOrEqualMd] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth >= 768
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      const handleResize = () =>
        setIsGreaterOrEqualMd(window.innerWidth >= 768);
      handleResize();
      window.addEventListener('resize', handleResize, { passive: true });
      return () => window.removeEventListener('resize', handleResize);
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event) => setIsGreaterOrEqualMd(event.matches);
    setIsGreaterOrEqualMd(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isGreaterOrEqualMd;
};

export default useIsGreaterOrEqualMd;
