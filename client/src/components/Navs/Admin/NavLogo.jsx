import React from 'react';
import { useNavigate } from 'react-router-dom';

const NavLogo = ({ onClick }) => {
  const navigate = useNavigate();

  return (
    <div
      className='relative flex items-center justify-center select-none gap-1 cursor-pointer'
      onClick={() => {
        navigate('/');
        onClick && onClick();
      }}
    >
      <span className='w-5 h-[0.5px] bg-onPrimary-main'></span>
      <h1 className='text-onPrimary-main text-pp-eiko uppercase text-md'>
        KHALID AHAMMED
      </h1>
    </div>
  );
};

export default NavLogo;
