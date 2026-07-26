import { IoArrowForward } from 'react-icons/io5';
import PropTypes from 'prop-types';

const PrimaryButton = ({
  text,
  onClick,
  classes = '',
  textClasses = '',
  Icon,
  type,
  state = 'normal', //normal||small
  btnState,
  disabled = false,
}) => {
  return (
    <button
      type={type || 'button'}
      disabled={disabled}
      className={
        `${
          state === 'small' ? 'py-2.5 px-4 text-xs' : 'py-3 px-5'
        } flex items-center justify-center bg-primary-main text-body-main rounded-2xl transition-all duration-300 border hover:border-primary-main border-body-main hover:bg-body-main hover:text-primary-main gap-2 group disabled:cursor-not-allowed disabled:opacity-60 ${
          btnState === 'error'
            ? 'text-primary-main bg-red-600 border-red-600 hover:bg-red-800 hover:border-red-800'
            : ''
        } ` + classes
      }
      onClick={onClick}
    >
      <span className={textClasses}>{text || 'Button'}</span>
      {Icon ? (
        <Icon
          aria-hidden='true'
          className={`group-hover:text-primary-main text-body-main hover:transition-all duration-300 ${
            state === 'small' ? 'text-[1rem]' : 'text-xl'
          } ${btnState === 'error' ? 'text-primary-main' : ''}`}
        />
      ) : (
        <IoArrowForward
          aria-hidden='true'
          className={`group-hover:text-primary-main text-body-main hover:transition-all duration-300 ${
            state === 'small' ? 'text-[1rem]' : 'text-xl'
          } ${btnState === 'error' ? 'text-primary-main' : ''}`}
        />
      )}
    </button>
  );
};


PrimaryButton.propTypes = {
  text: PropTypes.string,
  onClick: PropTypes.func,
  classes: PropTypes.string,
  textClasses: PropTypes.string,
  Icon: PropTypes.elementType,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  state: PropTypes.string,
  btnState: PropTypes.string,
  disabled: PropTypes.bool,
};

export default PrimaryButton;
