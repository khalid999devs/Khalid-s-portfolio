import { MdEdit } from 'react-icons/md';
import PropTypes from 'prop-types';

const RoundedIconBtn = ({ Icon, classes, onClick }) => {
  return (
    <button
      className={
        'w-7 h-7 rounded-full bg-primary-dark text-white text-md transition-all duration-300 hover:bg-black flex items-center justify-center ' +
        classes
      }
      onClick={onClick}
    >
      {Icon ? <Icon /> : <MdEdit />}
    </button>
  );
};


RoundedIconBtn.propTypes = {
  Icon: PropTypes.elementType,
  classes: PropTypes.string,
  onClick: PropTypes.func,
};

export default RoundedIconBtn;
