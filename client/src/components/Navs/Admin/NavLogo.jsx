import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { textBlinkAnimation } from '../../../animations/textBlinkAnimation';
import PropTypes from 'prop-types';

const NavLogo = ({ onClick }) => {
  const logoRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let animationHandle;

    if (logoRef.current) {
      animationHandle = textBlinkAnimation(logoRef.current);
    }

    return () => animationHandle?.kill();
  }, [navigate]);

  return (
    <button
      type='button'
      aria-label='Go to home page'
      className='relative flex items-center justify-center select-none gap-1 cursor-pointer'
      onClick={() => {
        navigate('/');
        onClick && onClick();
      }}
    >
      <span
        aria-hidden='true'
        className='w-5 h-[0.5px] bg-onPrimary-main'
      ></span>
      <span
        ref={logoRef}
        className='text-onPrimary-main text-pp-eiko uppercase text-base'
        style={{
          fontFamily: 'PP Eiko',
        }}
      >
        KHALID AHAMMED
      </span>
    </button>
  );
};

NavLogo.propTypes = {
  onClick: PropTypes.func,
};

export default NavLogo;
