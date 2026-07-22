import { useState } from 'react';
import { IoAddCircleOutline } from 'react-icons/io5';
import PropTypes from 'prop-types';

const IconedInput = ({
  name,
  handleSubmit,
  inputProps,
  size = 'small',
  inputClasses,
  classes,
}) => {
  const [value, setValue] = useState('');
  return (
    <form
      className={`grid grid-cols-[1fr_auto] gap-5 px-2.5 ${
        size === 'small'
          ? 'py-2 border rounded-md'
          : size === 'normal'
          ? 'py-2.5 border rounded-lg placeholder:font-extralight'
          : 'py-3 border rounded-lg placeholder:font-extralight'
      } border-secondary-main/50 ${classes}`}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(e, name, value);
        setValue('');
      }}
    >
      <input
        type={'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        name={name}
        {...inputProps}
        aria-label={inputProps?.['aria-label'] || `Add ${name || 'item'}`}
        className={
          `outline-hidden w-full placeholder:text-muted-main bg-transparent text-primary-main text-base ${
            size === 'small' && 'text-sm!'
          }  ` + inputClasses
        }
        placeholder='Name'
      />
      <button
        type='submit'
        aria-label={`Add ${name || 'item'}`}
        className='text-muted-light text-2xl flex items-center justify-center'
      >
        <IoAddCircleOutline aria-hidden='true' />
      </button>
    </form>
  );
};


IconedInput.propTypes = {
  name: PropTypes.string,
  handleSubmit: PropTypes.func,
  inputProps: PropTypes.object,
  size: PropTypes.string,
  inputClasses: PropTypes.string,
  classes: PropTypes.string,
};

export default IconedInput;
