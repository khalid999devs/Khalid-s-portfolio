import { MdOutlineArrowOutward } from 'react-icons/md';
import { MdOutlineArrowForwardIos } from 'react-icons/md';
import { MdOutlineArrowBackIos } from 'react-icons/md';
import { ScrollMouseAnime } from '../../assets';
import { useEffect, useRef } from 'react';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import useDocumentHeight from '../../hooks/useDocumentHeight';

const ProjectBanner = () => {
  const projecsParentRef = useRef(null);
  const documentHeight = useDocumentHeight();

  useEffect(() => {
    if (projecsParentRef.current) {
      const animatingElements = [
        ...document.querySelectorAll('.blink-animate'),
      ];

      if (animatingElements.length > 0) {
        animatingElements.forEach((ele) => {
          wordBlinkAnimation(ele, null, projecsParentRef.current, true, false);
        });
      }
    }
  }, []);

  useEffect(() => {
    let projectParentScrollTInstance;
    if (projecsParentRef.current) {
      projectParentScrollTInstance = ScrollTrigger.create({
        trigger: projecsParentRef.current,
        pin: true,
        pinSpacing: false,
        scrub: 0.2,
        start: 'top top',
      });
    }

    return () => {
      if (projectParentScrollTInstance) projectParentScrollTInstance.kill();
    };
  }, [documentHeight]);

  return (
    <div
      ref={projecsParentRef}
      className='pt-16 min-h-screen w-full pb-16 flex items-center justify-center relative'
    >
      <div className='flex flex-col w-full justify-center -translate-y-3'>
        <div className='flex items-center justify-center gap-5'>
          <div className='hidden sm:flex flex-col gap-3 md:gap-8 justify-between'>
            <p className='text-right text-onPrimary-dark text-xs 2xl:text-sm uppercase'>
              <span className='blink-animate'>Some</span> <br />
              <span className='blink-animate'>Selected</span>
            </p>
            <div className='flex gap-0.5 items-end justify-end text-xs text-onPrimary-dark text-right'>
              <MdOutlineArrowBackIos />
              <MdOutlineArrowForwardIos />
            </div>
          </div>

          <div>
            <h1 className='text-[4rem] sm:text-[70px] md:text-[105px] uppercase'>
              PROJECTS{' '}
            </h1>
          </div>

          <div className='flex-col hidden sm:flex gap-3 md:gap-7 justify-between'>
            <p className='text-left text-onPrimary-dark text-[10px] md:text-xs 2xl:text-sm uppercase'>
              <span className='blink-animate'>WEBSITES &</span> <br />
              <span className='blink-animate'>WEB APPS</span>
            </p>
            <p className='text-lg text-left text-onPrimary-dark'>
              <MdOutlineArrowOutward />
            </p>
          </div>
        </div>

        <div className='text-center translate-y-2 sm:translate-y-0'>
          <p className='text-primary-main text-sm -mt-1 opacity-80 uppercase'>
            <span className='blink-animate'>
              CUSTOMER PROJECTS, PERSONAL PROJECTS{' '}
            </span>{' '}
            <br /> <span className='blink-animate'>& SOME RESEARCHES</span>
          </p>
        </div>
      </div>

      <div className='absolute left-1/2 bottom-8 -translate-x-1/2 -translate-y-1/2'>
        <img src={ScrollMouseAnime} className='w-10 opacity-20' alt='mouse' />
      </div>
    </div>
  );
};

export default ProjectBanner;
