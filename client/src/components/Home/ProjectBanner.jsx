import { MdOutlineArrowOutward } from 'react-icons/md';
import { MdOutlineArrowForwardIos } from 'react-icons/md';
import { MdOutlineArrowBackIos } from 'react-icons/md';
import { ScrollMouseAnime } from '../../assets';
import { useEffect, useRef } from 'react';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

const ProjectBanner = () => {
  const projectsParentRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const animationHandles = [];

    if (projectsParentRef.current && !prefersReducedMotion) {
      const animatingElements = [
        ...projectsParentRef.current.querySelectorAll('.blink-animate'),
      ];

      if (animatingElements.length > 0) {
        animatingElements.forEach((ele) => {
          const handle = wordBlinkAnimation(
            ele,
            null,
            projectsParentRef.current,
            true,
            false
          );
          if (handle) animationHandles.push(handle);
        });
      }
    }

    return () => animationHandles.forEach((handle) => handle.kill());
  }, [prefersReducedMotion]);

  useEffect(() => {
    let projectParentScrollTInstance;
    if (projectsParentRef.current && !prefersReducedMotion) {
      projectParentScrollTInstance = ScrollTrigger.create({
        trigger: projectsParentRef.current,
        pin: true,
        pinSpacing: false,
        scrub: 0.2,
        start: 'top top',
      });
    }

    return () => {
      if (projectParentScrollTInstance) projectParentScrollTInstance.kill();
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={projectsParentRef}
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
              <MdOutlineArrowBackIos aria-hidden='true' />
              <MdOutlineArrowForwardIos aria-hidden='true' />
            </div>
          </div>

          <div>
            <h2 className='text-[4rem] sm:text-[70px] md:text-[105px] uppercase'>
              PROJECTS{' '}
            </h2>
          </div>

          <div className='flex-col hidden sm:flex gap-3 md:gap-7 justify-between'>
            <p className='text-left text-onPrimary-dark text-[10px] md:text-xs 2xl:text-sm uppercase'>
              <span className='blink-animate'>WEBSITES &</span> <br />
              <span className='blink-animate'>WEB APPS</span>
            </p>
            <p className='text-lg text-left text-onPrimary-dark'>
              <MdOutlineArrowOutward aria-hidden='true' />
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

      <div
        className={`absolute left-1/2 bottom-8 -translate-x-1/2 -translate-y-1/2 ${
          prefersReducedMotion ? 'hidden' : ''
        }`}
      >
        <img
          src={ScrollMouseAnime}
          width='150'
          height='150'
          className='w-10 opacity-20'
          alt=''
          aria-hidden='true'
        />
      </div>
    </div>
  );
};

export default ProjectBanner;
