import { useEffect, useMemo } from 'react';

/** Preview URLs for the entries of `items` that are still files, keyed by the file. */
const useObjectUrls = (items) => {
  const urls = useMemo(
    () =>
      new Map(
        (items ?? [])
          .filter((item) => item instanceof Blob)
          .map((file) => [file, URL.createObjectURL(file)])
      ),
    [items]
  );

  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);

  return urls;
};

export default useObjectUrls;
