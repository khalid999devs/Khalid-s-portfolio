import { IoEye } from 'react-icons/io5';
import { IoEyeOff } from 'react-icons/io5';

const Input = ({
  inputProps,
  label,
  alert,
  type,
  show,
  onShowClick,
  classes,
  inputClasses,
  textArea = false,
  size = 'normal',
  labelClass,
}) => {
  return (
    <div className={'grid gap-2 w-full ' + classes}>
      <label
        htmlFor={inputProps?.name}
        className={
          `${
            size === 'small'
              ? 'text-sm'
              : size === 'normal'
              ? 'text-sm'
              : 'text-md'
          } text-secondary-light font-medium opacity-90 ` + labelClass
        }
      >
        {label}
      </label>
      <div className='relative'>
        {!textArea ? (
          <input
            type={type || 'text'}
            {...inputProps}
            className={
              `p-3.5 ${
                size === 'small'
                  ? 'py-2 border-b rounded-md'
                  : size === 'normal'
                  ? 'py-2.5 border rounded-lg placeholder:font-extralight'
                  : 'py-3 border rounded-lg placeholder:font-extralight'
              } text-md border-opacity-50 border-secondary-main outline-none w-full placeholder:text-secondary-main placeholder:opacity-100 bg-transparent text-primary-main ` +
              inputClasses
            }
          />
        ) : (
          <textarea
            {...inputProps}
            className={
              `p-3.5 py-2.5 text-sm border border-opacity-50 border-secondary-main outline-none rounded-lg w-full bg-transparent placeholder:text-secondary-main placeholder:opacity-80 placeholder:font-extralight text-text-main ` +
              inputClasses
            }
          ></textarea>
        )}
        {(show === true || show === false) && (
          <div
            className={`absolute right-[3%] top-[50%] cursor-pointer`}
            style={{ transform: 'translate(-50%,-50%)' }}
            onClick={onShowClick}
          >
            {show ? <IoEye /> : <IoEyeOff />}
          </div>
        )}
      </div>

      {alert?.msg && (
        <p
          className={`${
            alert.state === 'error'
              ? 'text-red-400'
              : alert.state === 'none'
              ? 'text-tertiary-main'
              : 'text-orange-300'
          } text-xs ml-1 -mt-1.5`}
        >
          {alert.msg}
        </p>
      )}
    </div>
  );
};

export default Input;
