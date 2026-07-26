import { useEffect, useState } from 'react';

const useObjectUrl = (value) => {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (
      typeof URL === 'undefined' ||
      typeof Blob === 'undefined' ||
      !(value instanceof Blob)
    ) {
      setObjectUrl(null);
      return undefined;
    }

    const nextObjectUrl = URL.createObjectURL(value);
    setObjectUrl(nextObjectUrl);

    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [value]);

  return objectUrl;
};

export default useObjectUrl;
