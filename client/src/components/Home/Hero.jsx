import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { socialLinks, upworkedSocialLinks } from '../../Constants';
import { textBlinkAnimation } from '../../animations/textBlinkAnimation';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';

/**
 * Three.js, @react-three/fiber and drei are ~60% of the site's JavaScript and
 * were pulled into the critical bundle by an eager import here -- every visitor
 * downloaded the entire 3D stack before anything could render.
 *
 * `Scene` already waits 1200ms before mounting its canvas, so the module now
 * loads during a delay that existed anyway. The bot appears at the same moment,
 * with the same appearance; only the download moves off the critical path.
 *
 * The fallback is null, matching what `Scene` itself renders before its timer
 * fires, so nothing new is drawn and no layout shifts.
 */
const Scene = lazy(() => import('./bot/Scene'));
import { isUpwork } from '../../config';
import HeroGreeting from './HeroGreeting';
import { textBlinkAnimateByWord } from '../../animations/textBlinkAnimateByWord';
import { useMichibotInteraction } from '../../hooks/useMichibotInteraction';

const GREETINGS = [
  'Hi There',
  'Stay Curious',
  'Sweat Details',
  'Think First',
  'Ship Often',
  'Keep Learning',
  'Still Building',
];

/** How long each phrase holds before the next one scrambles in. */
const GREETING_INTERVAL_MS = 5000;

const Hero = () => {
  const nameTitleRef = useRef(null);
  const developerTitleRef = useRef(null);
  const countryRef = useRef(null);
  const passionRef = useRef(null);
  const heroRef = useRef(null);
  const botContainerRef = useRef(null);
  const [botHovered, setBotHovered] = useState(false);
  const [greeting, setGreeting] = useState(GREETINGS[0]);

  const { isActive, isDesktop, isLoaded, setIsLoaded, handleClick } =
    useMichibotInteraction(botContainerRef, heroRef);

  useEffect(() => {
    if (botHovered) return undefined;

    const id = setInterval(() => {
      setGreeting((current) => {
        const others = GREETINGS.filter((phrase) => phrase !== current);
        return others[Math.floor(Math.random() * others.length)];
      });
    }, GREETING_INTERVAL_MS);

    return () => clearInterval(id);
  }, [botHovered]);

  useEffect(() => {
    const timelines = [];
    if (nameTitleRef.current) {
      timelines.push(textBlinkAnimateByWord(nameTitleRef.current));
    }
    if (developerTitleRef.current) {
      timelines.push(textBlinkAnimation(developerTitleRef.current));
    }

    const triggers = [];
    if (heroRef.current) {
      if (countryRef.current) {
        triggers.push(
          wordBlinkAnimation(countryRef.current, null, heroRef.current, true)
        );
      }
      if (passionRef.current) {
        triggers.push(
          wordBlinkAnimation(passionRef.current, null, heroRef.current, true)
        );
      }
    }

    // Killed on unmount, or each visit leaves a ScrollTrigger holding this
    // element and every per-word span it created.
    return () => {
      triggers.forEach((trigger) => trigger?.kill());
      timelines.forEach((timeline) => timeline?.kill());
    };
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
          className='flex absolute left-1/2 w-[100px] items-center justify-center flex-col gap-5 z-40'
          style={{ transform: 'translate(-50%,-20%) scale(0.7)' }}
        >
          <div className='flex items-center justify-center flex-row gap-2.5 whitespace-nowrap'>
            <span className='w-4 h-4 bg-white'></span>
            <HeroGreeting text={botHovered ? 'Click Me' : greeting} />
          </div>
          <div className='w-full min-h-[20px] flex mt-12 relative'>
            <div
              ref={botContainerRef}
              className={`absolute w-[350px] h-[300px] left-[100%] -translate-x-1/2 transition-all duration-300 ${
                isDesktop && isLoaded ? 'cursor-pointer' : ''
              } ${isActive ? 'z-50 michibot-active' : 'z-40'}`}
              onClick={handleClick}
              onMouseEnter={() =>
                isDesktop && isLoaded && !isActive && setBotHovered(true)
              }
              onMouseLeave={() => setBotHovered(false)}
            >
              <Suspense fallback={null}>
                <Scene onLoad={() => setIsLoaded(true)} isActive={isActive} />
              </Suspense>
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
            {'<SOFTWARE ENGINEER/>'}
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
