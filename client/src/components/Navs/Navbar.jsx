import React from 'react';
import NavLogo from './Admin/NavLogo';
import { Link, useNavigate } from 'react-router-dom';
import { OutlinedSmallButton } from '../Buttons/OutlinedButton';

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <div className='w-full fixed top-0 left-0 z-50'>
      <div className='screen-max-width py-3.5 sec-x-padding flex items-center justify-between'>
        <div>
          <NavLogo />
        </div>
        <div>
          <OutlinedSmallButton
            text={'My Resume'}
            onClick={() => {
              navigate('/');
            }}
          />
        </div>
        <div className='flex items-center justify-between gap-8 text-md'>
          <Link to={'/projects'} className='transition-all hover:opacity-85'>
            Projects
          </Link>
          <Link
            to={'mailto:khalidahammeduzzal@gmail.com'}
            className='transition-all hover:opacity-85'
          >
            Email Me
          </Link>
          <div className='w-8 grid gap-1.5'>
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
            <span className='w-full h-[1px] bg-onPrimary-dark'></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
