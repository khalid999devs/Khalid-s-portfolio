import React, { useEffect, useRef, useState } from 'react';
import { MdOutlineArrowRightAlt } from 'react-icons/md';
import { BiSolidRightArrow } from 'react-icons/bi';
import { socialLinks } from '../../Constants';

const Footer = () => {
  const timeRef = useRef(null);

  useEffect(() => {
    let iid;
    const timeContainer = timeRef.current;
    if (timeContainer) {
      iid = setInterval(() => {
        timeContainer.innerText = new Date().toLocaleTimeString();
      }, 1000);
    }

    return () => {
      if (iid) {
        clearInterval(iid);
      }
    };
  }, []);

  return (
    <div className='w-full  mt-8 mb-10'>
      <div className='w-full screen-max-width sec-x-padding'>
        <div className='w-full border-[1px] border-secondary-light rounded-2xl pt-14 pb-10 px-10 xl:px-14'>
          <div className='w-full pb-12 border-b-[0.7px] border-opacity-40 border-secondary-main'>
            <div className='flex w-full flex-col gap-8 md:gap-3 md:flex-row md:justify-between md:items-end'>
              <h1
                className='text-white text-[1.5rem] md:text-[3rem] max-w-[350px] w-full'
                style={{ lineHeight: '125%' }}
              >
                Let's create something great together
              </h1>

              <div className='flex items-center md:justify-end gap-1 group'>
                <MdOutlineArrowRightAlt className='text-white text-4xl transition-transform duration-1000 group-hover:translate-x-1' />
                <a
                  href='mailto:khalidahammeduzzal@gmail.com'
                  className='text-lg md:text-3xl text-pp-eiko uppercase text-flicker thick-underline'
                >
                  SEND ME AN EMAIL
                </a>
              </div>
            </div>

            <div className='mt-6 flex w-full flex-col text-secondary-light gap-3 md:flex-row md:justify-between md:items-center'>
              <p className='text-xs text-montreal-mono'>
                BASED IN BANGLADESH — WORKING WORLDWIDE{' '}
              </p>
              <div className='flex items-center gap-4'>
                <div className='flex item-center gap-1 '>
                  <p className='text-xs text-montreal-mono'>LOCAL TIME</p>
                  <BiSolidRightArrow className='text-xs mt-0.5' />
                </div>
                <p className='text-white text-xs' ref={timeRef}>
                  {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          <div className='w-full pt-8 flex flex-col gap-7 md:gap-4 md:flex-row md:items-center md:justify-between'>
            <div className='w-8 m-auto md:m-0 h-7 rounded-lg bg-white'></div>
            {/* social links */}
            <div className='flex w-full flex-wrap items-center justify-center flex-row gap-7 md:gap-8 lg:gap-14'>
              {socialLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.path}
                  target='_blank'
                  rel='noreferrer'
                  className='transition-all duration-300 text-sm text-flicker'
                >
                  {link.title}
                </a>
              ))}
            </div>

            {/* Credit */}
            <div className='flex flex-col items-center justify-center md:justify-end md:items-end gap-0.5 text-secondary-light text-[0.7rem] text-right'>
              <p> &copy; {new Date().getFullYear()} KhalidDevs </p>
              <p className='whitespace-nowrap'>
                Made with 🤍 by Khalid Ahammed
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;
