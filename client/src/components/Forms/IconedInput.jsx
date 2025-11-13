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
      className={`grid grid-cols-[1fr,auto] gap-5 px-2.5 ${
        size === 'small'
          ? 'py-2 border rounded-md'
          : size === 'normal'
          ? 'py-2.5 border rounded-lg placeholder:font-extralight'
          : 'py-3 border rounded-lg placeholder:font-extralight'
      } border-opacity-50 border-secondary-main ${classes}`}
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
        className={
          `outline-none w-full placeholder:text-secondary-main placeholder:opacity-100 bg-transparent text-primary-main text-base ${
            size === 'small' && '!text-sm'
          }  ` + inputClasses
        }
        placeholder='Name'
      />
      <button
        type='submit'
        className='text-secondary-light text-2xl flex items-center justify-center'
      >
        <IoAddCircleOutline />
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
