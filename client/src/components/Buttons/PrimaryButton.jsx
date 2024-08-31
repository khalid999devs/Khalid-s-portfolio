import { IoArrowForward } from 'react-icons/io5';

const PrimaryButton = ({
  text,
  onClick,
  classes,
  Icon,
  type,
  state = 'normal', //normal||small
}) => {
  return (
    <button
      type={type || 'button'}
      className={
        'py-3 px-5 flex items-center justify-center bg-primary-main text-body-main rounded-2xl transition-all duration-300 border hover:border-primary-main border-body-main border-1 hover:bg-body-main hover:text-primary-main gap-2 group ' +
        classes
      }
      onClick={onClick}
    >
      <span>{text || 'Button'}</span>
      {Icon ? (
        <Icon className='group-hover:text-primary-main text-body-main hover:transition-all duration-300 text-xl' />
      ) : (
        <IoArrowForward className='group-hover:text-primary-main text-body-main hover:transition-all duration-300 text-xl' />
      )}
    </button>
  );
};

export default PrimaryButton;
