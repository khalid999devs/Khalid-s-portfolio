import { IoArrowForward } from 'react-icons/io5';

const PrimaryButton = ({
  text,
  onClick,
  classes,
  Icon,
  type,
  state = 'normal', //normal||small
  btnState,
}) => {
  return (
    <button
      type={type || 'button'}
      className={
        `${
          state === 'small' ? 'py-2.5 px-4 text-xs' : 'py-3 px-5'
        } flex items-center justify-center bg-primary-main text-body-main rounded-2xl transition-all duration-300 border hover:border-primary-main border-body-main border-1 hover:bg-body-main hover:text-primary-main gap-2 group ${
          btnState === 'error' &&
          'text-primary-main bg-red-600 border-red-600 hover:bg-red-800 hover:border-red-800'
        } ` + classes
      }
      onClick={onClick}
    >
      <span>{text || 'Button'}</span>
      {Icon ? (
        <Icon
          className={`group-hover:text-primary-main text-body-main hover:transition-all duration-300 ${
            state === 'small' ? 'text-[1rem]' : 'text-xl'
          } ${btnState === 'error' && 'text-primary-main'}`}
        />
      ) : (
        <IoArrowForward
          className={`group-hover:text-primary-main text-body-main hover:transition-all duration-300 ${
            state === 'small' ? 'text-[1rem]' : 'text-xl'
          } ${btnState === 'error' && 'text-primary-main'}`}
        />
      )}
    </button>
  );
};

export default PrimaryButton;
