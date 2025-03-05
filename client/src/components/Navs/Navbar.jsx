import React, { useEffect, useRef, useState } from 'react';
import NavLogo from './Admin/NavLogo';
import { Link, useNavigate } from 'react-router-dom';
import { OutlinedSmallButton } from '../Buttons/OutlinedButton';
import PageNav from './PageNav';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';

const Navbar = () => {
  const navigate = useNavigate();
  const [isPageMenu, setIsPageMenu] = useState(false);
  const navBarRef = useRef(null);

  useEffect(() => {
    if (isPageMenu === true) {
      document.body.style.overflow = 'hidden';
    } else if (isPageMenu === false) {
      document.body.style.overflow = 'auto';
    }
  }, [isPageMenu]);

  useEffect(() => {
    if (navBarRef.current) {
      const animatingElements = [
        ...document.querySelectorAll('.blink-animate-nav'),
      ];

      if (animatingElements.length > 0) {
        animatingElements.forEach((ele) => {
          wordBlinkAnimation(ele, null, navBarRef.current, false, false);
        });
      }
    }
  }, []);

  return (
    <div ref={navBarRef} className='w-full fixed top-0 left-0 z-50'>
      <div className='screen-max-width py-3.5 sec-x-padding flex items-center justify-between mix-blend-difference'>
        <div>
          <NavLogo />
        </div>
        <div className='hidden sm:inline-block'>
          <OutlinedSmallButton
            text={'My Resume'}
            onClick={() => {
              navigate('/');
            }}
          />
        </div>
        <div className='flex items-center justify-between gap-6 text-sm'>
          <Link
            to={'/projects'}
            className='hidden sm:inline blink-animate-nav text-flicker'
          >
            Projects
          </Link>
          <Link
            to={'mailto:khalidahammeduzzal@gmail.com'}
            className='hidden sm:inline blink-animate-nav text-flicker'
          >
            Email Me
          </Link>

          {/* hamburger */}
          <div
            className='w-8 h-auto grid gap-1.5 select-none cursor-pointer'
            onClick={() => {
              setIsPageMenu(true);
              // document.body.style.overflowY = 'hidden';
            }}
          >
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
          </div>
        </div>
      </div>

      {/* nav menu page */}
      <PageNav isPageMenu={isPageMenu} setIsPageMenu={setIsPageMenu} />
    </div>
  );
};

export default Navbar;
