import PropTypes from 'prop-types';
import LoadingSpinner from './LoadingSpinner';

const Loader = ({ classes = '' }) => (
  <LoadingSpinner
    className={`w-full flex-grow items-start ${classes}`}
    label='Loading content'
    sizeClass='h-16 w-16'
  />
);


Loader.propTypes = {
  classes: PropTypes.string,
};

export default Loader;
