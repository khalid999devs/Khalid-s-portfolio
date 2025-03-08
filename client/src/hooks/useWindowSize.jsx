import { useState, useEffect } from 'react';

const useWindowSize = () => {
  const [isSizeChanged, setIsSizeChanged] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSizeChanged((prevState) => !prevState);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isSizeChanged;
};

export default useWindowSize;
