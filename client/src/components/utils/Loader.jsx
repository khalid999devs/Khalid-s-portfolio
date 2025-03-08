import React from 'react';
import { loadingGif } from '../../assets';

const Loader = ({ classes }) => {
  return (
    <div
      className={'w-full flex-grow flex items-start justify-center ' + classes}
    >
      <img
        src={loadingGif}
        className='w-[100px] h-[100px]'
        alt='loading img'
        loading='eager'
      />
    </div>
  );
};

export default Loader;
