import { useEffect, useRef } from 'react';
import { socialLinks, upworkedSocialLinks } from '../../Constants';
import { textBlinkAnimation } from '../../animations/textBlinkAnimation';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';
import Scene from './bot/Scene';
import { isUpwork } from '../../config';
import { textBlinkAnimateByWord } from '../../animations/textBlinkAnimateByWord';

const Hero = () => {
  const nameTitleRef = useRef(null);
  const developerTitleRef = useRef(null);
  const countryRef = useRef(null);
  const passionRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    if (nameTitleRef.current) {
      textBlinkAnimateByWord(nameTitleRef.current);
    }
    if (developerTitleRef.current) {
      textBlinkAnimation(developerTitleRef.current);
    }
    if (heroRef.current) {
      if (countryRef.current) {
        wordBlinkAnimation(countryRef.current, null, heroRef.current, true);
      }
      if (passionRef.current) {
        wordBlinkAnimation(passionRef.current, null, heroRef.current, true);
      }
    }
  }, []);

  return (
    <div
      ref={heroRef}
      className='min-h-screen body-max-width sec-inner-x-padding grid items-stretch gap-4 w-full pt-[160px] pb-2'
    >
      <div className='flex relative items-center justify-between mt- w-full'>
        <p
          ref={countryRef}
          className='hidden sm:inline sm:text-[10px] md:text-xs text-montreal-mono text-secondary-light uppercase pointer-all'
        >
          Based in Bangladesh
        </p>
        <div
          className='flex absolute left-1/2 items-center justify-center flex-col gap-5 z-40'
          style={{ transform: 'translate(-50%,-20%) scale(0.7)' }}
        >
          <div className='flex items-center justify-center flex-row gap-2.5'>
            <span className='w-4 h-4 bg-white'></span>
            <p className='text-lg xl:text-xl capitalize'>Hi There</p>
          </div>
          <div className='w-full min-h-[20px] flex mt-12 relative'>
            <div className='absolute w-[350px] h-[300px] left-[100%] -translate-x-1/2'>
              <Scene />
            </div>
          </div>
        </div>
        <p
          ref={passionRef}
          className='hidden sm:inline sm:text-[11px] text-xs text-montreal-mono text-secondary-light uppercase pointer-all'
        >
          Passionate Programmer
        </p>
      </div>

      {/* title and subtitle */}
      <div className='relative text-center mt-14'>
        <div>
          <h1
            ref={nameTitleRef}
            className='text-[3.2rem] sm:text-[55px] md:text-[60px] lg:text-[75px] 2xl:text-[100px] text-rox-italic uppercase md:mr-16'
          >
            KHALID AHAMMED
          </h1>
        </div>
        <div className='mt-6 sm:-mt-1'>
          <h2
            ref={developerTitleRef}
            className='text-montreal-medium text-[1.6rem] sm:text-[38px] md:text-[40px] lg:text-[58px] 2xl:text-[75px] 3xl:text-[80px] uppercase md:ml-36'
          >
            {'<FULLSTACK DEVELOPER/>'}
          </h2>
        </div>
      </div>

      {/* social links */}
      <div className='flex w-full items-center justify-center flex-row gap-6 sm:gap-8 lg:gap-14'>
        {(isUpwork ? upworkedSocialLinks : socialLinks).map((link, index) => (
          <a
            key={index}
            href={link.path}
            target='_blank'
            rel='noreferrer'
            className='transition-all duration-300 text-xs sm:text-sm text-flicker pointer-all'
          >
            {link.title}
          </a>
        ))}
      </div>
    </div>
  );
};

export default Hero;
