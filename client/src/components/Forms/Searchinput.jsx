import { useState } from 'react';
import { IoSearch } from 'react-icons/io5';

const Searchinput = ({ onSubmit, onChange }) => {
  const [value, setValue] = useState('');
  return (
    <div className='w-full'>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit && onSubmit(e);
        }}
        className='w-full flex gap-1 pl-2 pr-4 text-secondary-light'
      >
        <div className='flex items-center justify-center'>
          <IoSearch className='text-xl text-secondary-light' />
        </div>
        <input
          type='text'
          name='search'
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange && onChange(e.target.value);
          }}
          className='text-lg min-w-[100px] px-2 placeholder:text-secondary-light bg-transparent text-primary-main outline-none'
          placeholder='Search here...'
        />
      </form>
    </div>
  );
};

export default Searchinput;
