import { useState } from 'react';

/**
 * State that is refilled whenever one of `deps` changes and is otherwise the
 * component's own to edit. `read` returns the new value, or undefined to leave
 * the state as it is.
 */
const useSyncedState = (initial, read, deps) => {
  const [value, setValue] = useState(initial);
  const [seen, setSeen] = useState(null);

  if (!seen || deps.some((dep, index) => dep !== seen[index])) {
    setSeen(deps);
    const next = read();
    if (next !== undefined) setValue(next);
  }

  return [value, setValue];
};

export default useSyncedState;
