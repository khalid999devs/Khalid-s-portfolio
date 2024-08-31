import React from 'react';
import { avatarImg } from '../../../assets';

const Avatar = () => {
  return (
    <div className='w-[33px] h-[31px]'>
      <img src={avatarImg} className='w-full h-full' alt='Av' />
    </div>
  );
};

export default Avatar;
