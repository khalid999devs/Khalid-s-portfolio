import React from 'react';
import { BsFillCaretRightFill } from 'react-icons/bs';

const TextDividerHeading = ({ role = 'ROLE/SERVICES', text }) => {
  return (
    <div className='w-full sm:max-w-[250px] sm:w-full grid gap-6'>
      <div className='flex items-center gap-1'>
        <span className='text-[12px] sm:text-xs text-secondary-main opacity-80 uppercase'>
          # {role}
        </span>
        <BsFillCaretRightFill className='text-secondary-main text-xs' />
      </div>
      <div className='h-[0.1px] opacity-60 bg-secondary-main w-full'></div>
      <div className='text-sm leading-7'>{text}</div>
    </div>
  );
};

export default TextDividerHeading;
