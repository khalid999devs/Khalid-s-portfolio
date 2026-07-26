import PropTypes from 'prop-types';

const LoadingSpinner = ({
  className = '',
  label = 'Loading',
  sizeClass = 'h-10 w-10',
}) => (
  <div
    className={`flex items-center justify-center ${className}`}
    role='status'
    aria-live='polite'
  >
    <span className='sr-only'>{label}</span>
    <span
      aria-hidden='true'
      className={`${sizeClass} rounded-full border-4 border-primary-main/30 border-t-primary-main animate-spin motion-reduce:animate-none`}
    />
  </div>
);

LoadingSpinner.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
  sizeClass: PropTypes.string,
};

export default LoadingSpinner;
