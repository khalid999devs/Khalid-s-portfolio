import { useId } from 'react';
import { IoEye } from 'react-icons/io5';
import { IoEyeOff } from 'react-icons/io5';
import PropTypes from 'prop-types';

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
  const generatedId = useId();
  const inputId = inputProps?.id || inputProps?.name || generatedId;
  const alertId = `${inputId}-message`;
  const describedBy = [
    inputProps?.['aria-describedby'],
    alert?.msg ? alertId : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;
  const isInvalid =
    inputProps?.['aria-invalid'] ??
    (alert?.state === 'error' && Boolean(alert?.msg));

  return (
    <div className={'grid gap-2 w-full ' + classes}>
      <label
        htmlFor={inputId}
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
            id={inputId}
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
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
            id={inputId}
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
            className={
              `p-3.5 py-2.5 text-sm border border-opacity-50 border-secondary-main outline-none rounded-lg w-full bg-transparent placeholder:text-secondary-main placeholder:opacity-80 placeholder:font-extralight text-text-main ` +
              inputClasses
            }
          ></textarea>
        )}
        {(show === true || show === false) && (
          <button
            type='button'
            className='absolute right-[3%] top-[50%] cursor-pointer'
            style={{ transform: 'translate(-50%,-50%)' }}
            onClick={onShowClick}
            aria-label={show ? 'Hide password' : 'Show password'}
            aria-pressed={show}
          >
            {show ? (
              <IoEye aria-hidden='true' />
            ) : (
              <IoEyeOff aria-hidden='true' />
            )}
          </button>
        )}
      </div>

      {alert?.msg && (
        <p
          id={alertId}
          role={alert.state === 'error' ? 'alert' : 'status'}
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


Input.propTypes = {
  inputProps: PropTypes.object,
  label: PropTypes.string,
  alert: PropTypes.shape({
    msg: PropTypes.string,
    state: PropTypes.string,
  }),
  type: PropTypes.string,
  show: PropTypes.bool,
  onShowClick: PropTypes.func,
  classes: PropTypes.string,
  inputClasses: PropTypes.string,
  textArea: PropTypes.bool,
  size: PropTypes.string,
  labelClass: PropTypes.string,
};

export default Input;
