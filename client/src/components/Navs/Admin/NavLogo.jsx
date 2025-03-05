import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { textBlinkAnimation } from '../../../animations/textBlinkAnimation';

const NavLogo = ({ onClick }) => {
  const navigate = useNavigate();
  const logoRef = useRef(null);

  useEffect(() => {
    if (logoRef.current) {
      textBlinkAnimation(logoRef.current);
    }
  }, []);

  return (
    <div
      className='relative flex items-center justify-center select-none gap-1 cursor-pointer'
      onClick={() => {
        navigate('/');
        onClick && onClick();
      }}
    >
      <span className='w-5 h-[0.5px] bg-onPrimary-main'></span>
      <h1
        ref={logoRef}
        className='text-onPrimary-main !text-pp-eiko uppercase text-md'
        style={{
          fontFamily: 'PP Eiko',
        }}
      >
        KHALID AHAMMED
      </h1>
    </div>
  );
};

export default NavLogo;
