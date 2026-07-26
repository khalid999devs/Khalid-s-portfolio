import { MdNotificationsNone } from 'react-icons/md';
import PropTypes from 'prop-types';

const IconButton = ({
  classes,
  onClick,
  Icon = MdNotificationsNone,
  label = 'Notifications',
}) => {
  return (
    <button
      type='button'
      aria-label={label}
      className={
        'w-[33px] h-[31px] flex items-center justify-center cursor-pointer text-muted-light text-xl border-secondary-light border rounded-[10px] hover:bg-secondary-light transition-all duration-300 hover:text-body-main group ' +
        classes
      }
      onClick={onClick}
    >
      {
        <Icon
          aria-hidden='true'
          className='group-hover:text-body-main group-hover:transition-all group-hover:duration-300'
        />
      }
    </button>
  );
};


IconButton.propTypes = {
  classes: PropTypes.string,
  onClick: PropTypes.func,
  Icon: PropTypes.elementType,
  label: PropTypes.string,
};

export default IconButton;
