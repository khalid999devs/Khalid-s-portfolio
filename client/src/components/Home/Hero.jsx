import React from 'react';
import { langGrpImg, MainRobotImg } from '../../assets';
import { socialLinks } from '../../Constants';

const Hero = () => {
  return (
    <div className='min-h-screen body-max-width sec-inner-x-padding grid items-stretch gap-4 w-full pt-[160px] pb-2'>
      <div className='flex relative items-center justify-between mt- w-full'>
        <p className='text-xs text-montreal-mono text-secondary-light uppercase'>
          Based in Bangladesh
        </p>
        <div
          className='flex absolute left-1/2 items-center justify-center flex-col gap-5'
          style={{ transform: 'translate(-50%,-20%) scale(0.7)' }}
        >
          <div className='flex items-center justify-center flex-row gap-2.5'>
            <span className='w-4 h-4 bg-white'></span>
            <p className='text-lg xl:text-xl capitalize'>Hi There</p>
          </div>
          <div className='w-full flex mt-12 relative'>
            <img
              src={MainRobotImg}
              className='absolute min-h-[100px] min-w-fit w-auto top-1/2 left-1/2 z-10 max-h-[120px] h-auto'
              style={{ transform: 'translate(-50%,-50%)' }}
              alt='main-robot'
              loading='lazy'
            />

            <img
              src={langGrpImg}
              className='absolute min-w-fit top-1/2 left-[49%] w-auto -z-0 max-h-[120px] h-auto opacity-80'
              style={{ transform: 'translate(-50%,-50%)' }}
              alt='main-robot'
              loading='lazy'
            />
          </div>
        </div>
        <p className='text-xs text-montreal-mono text-secondary-light uppercase'>
          Passionate Programmer
        </p>
      </div>

      {/* title and subtitle */}
      <div className='relative text-center mt-14'>
        <div>
          <h1 className='text-[55px] md:text-[60px] lg:text-[75px] 2xl:text-[114px] 3xl:text-[105px] text-rox-italic uppercase md:mr-16'>
            KHALID AHAMMED
          </h1>
        </div>
        <div className='-mt-1'>
          <h2 className='text-montreal-medium text-[38px] md:text-[40px] lg:text-[58px] 2xl:text-[75px] 3xl:text-[85px] uppercase md:ml-36'>
            {'<FULLSTACK DEVELOPER/>'}
          </h2>
        </div>
      </div>

      {/* social links */}
      <div className='flex w-full items-center justify-center flex-row gap-3 md:gap-8 lg:gap-14'>
        {socialLinks.map((link, index) => (
          <a
            key={index}
            href={link.path}
            target='_blank'
            rel='noreferrer'
            className='transition-all duration-300 text-sm hover:opacity-75 hover:underline'
          >
            {link.title}
          </a>
        ))}
      </div>
    </div>
  );
};

export default Hero;
