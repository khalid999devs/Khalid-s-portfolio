import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { textBlinkAnimation } from '../../../animations/textBlinkAnimation';
import PropTypes from 'prop-types';

const NavLogo = ({ onClick }) => {
  const logoRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (logoRef.current) {
      textBlinkAnimation(logoRef.current);
    }
  }, [navigate]);

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

NavLogo.propTypes = {
  onClick: PropTypes.func,
};

export default NavLogo;
