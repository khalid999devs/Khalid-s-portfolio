import { useState, useEffect } from 'react';

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState(() =>
    typeof window === 'undefined'
      ? '0x0'
      : `${window.innerWidth}x${window.innerHeight}`
  );

  useEffect(() => {
    let animationFrameId;

    const handleResize = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        setWindowSize(`${window.innerWidth}x${window.innerHeight}`);
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return windowSize;
};

export default useWindowSize;
