import { IoSearch } from 'react-icons/io5';
import PropTypes from 'prop-types';

/**
 * Controlled by whoever renders it.
 *
 * It used to keep the value in its own `useState` and only notify a parent if
 * an `onChange` happened to be passed. The admin bar rendered it with no props
 * at all, so the box looked working, accepted typing, and filtered nothing.
 * Owning the value internally is what made that easy to miss: the input still
 * updated on screen, which is the only feedback most people check.
 */
const Searchinput = ({ value = '', onChange, onSubmit, placeholder }) => {
  return (
    <div className='w-full'>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit && onSubmit(value);
        }}
        className='w-full flex gap-1 pl-2 pr-4 text-secondary-light'
      >
        <div className='flex items-center justify-center'>
          <IoSearch className='text-xl text-secondary-light' />
        </div>
        <input
          type='search'
          name='search'
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          className='text-lg min-w-[100px] px-2 placeholder:text-secondary-light bg-transparent text-primary-main outline-none'
          placeholder={placeholder || 'Search here...'}
        />
      </form>
    </div>
  );
};

Searchinput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onSubmit: PropTypes.func,
  placeholder: PropTypes.string,
};

export default Searchinput;
