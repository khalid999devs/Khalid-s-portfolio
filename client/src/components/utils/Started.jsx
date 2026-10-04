import { useEffect } from 'react';
import PropTypes from 'prop-types';

// Tells the boot script in index.html that the app is on screen.
const Started = ({ children }) => {
  useEffect(() => {
    window.__appStarted?.();
  }, []);
  return children;
};

Started.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Started;
