import { MdEdit } from 'react-icons/md';
import PropTypes from 'prop-types';

const RoundedIconBtn = ({ Icon, classes, onClick, label = 'Edit' }) => {
  return (
    <button
      type='button'
      aria-label={label}
      className={
        'w-7 h-7 rounded-full bg-primary-dark text-white text-base transition-all duration-300 hover:bg-black flex items-center justify-center ' +
        classes
      }
      onClick={onClick}
    >
      {Icon ? <Icon aria-hidden='true' /> : <MdEdit aria-hidden='true' />}
    </button>
  );
};


RoundedIconBtn.propTypes = {
  Icon: PropTypes.elementType,
  classes: PropTypes.string,
  onClick: PropTypes.func,
  label: PropTypes.string,
};

export default RoundedIconBtn;
