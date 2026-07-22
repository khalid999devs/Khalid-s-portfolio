'use client';

import { useState, useEffect } from 'react';

const useDocumentHeight = () => {
  const [height, setHeight] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.scrollHeight : 0
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastHeight = document.documentElement.scrollHeight;
    let animationFrameId;

    const updateHeight = () => {
      animationFrameId = undefined;
      const newHeight = document.documentElement.scrollHeight;
      if (newHeight !== lastHeight) {
        setHeight(newHeight);
        lastHeight = newHeight;
      }
    };

    const scheduleUpdate = () => {
      if (animationFrameId !== undefined) return;
      animationFrameId = window.requestAnimationFrame(updateHeight);
    };

    let observer;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(scheduleUpdate);
      observer.observe(document.documentElement);
      observer.observe(document.body);
    } else {
      observer = new MutationObserver(scheduleUpdate);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener('resize', scheduleUpdate, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return height;
};

export default useDocumentHeight;
