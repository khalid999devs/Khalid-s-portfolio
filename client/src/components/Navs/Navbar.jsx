import React from 'react';
import NavLogo from './Admin/NavLogo';
import { Link, useNavigate } from 'react-router-dom';
import { OutlinedSmallButton } from '../Buttons/OutlinedButton';

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <div className='w-full fixed top-0 left-0 z-50'>
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
            className='hidden sm:inline transition-all hover:opacity-85 hover:underline duration-300'
          >
            Projects
          </Link>
          <Link
            to={'mailto:khalidahammeduzzal@gmail.com'}
            className='hidden sm:inline transition-all hover:opacity-85 hover:underline duration-300'
          >
            Email Me
          </Link>

          {/* hamburger */}
          <div className='w-8 grid gap-1.5 select-none cursor-pointer'>
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
          </div>
        </div>
      </div>

      {/* nav menu page */}
    </div>
  );
};

export default Navbar;
