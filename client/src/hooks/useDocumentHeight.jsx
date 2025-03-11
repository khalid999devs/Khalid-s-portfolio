'use client';

import { useState, useEffect } from 'react';

const useDocumentHeight = () => {
  const [height, setHeight] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.scrollHeight : 0
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastHeight = document.documentElement.scrollHeight;

    const updateHeight = () => {
      const newHeight = document.documentElement.scrollHeight;
      if (newHeight !== lastHeight) {
        setHeight(newHeight);
        lastHeight = newHeight;
      }
    };

    const observer = new MutationObserver(updateHeight);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  return height;
};

export default useDocumentHeight;
