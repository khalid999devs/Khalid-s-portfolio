import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { socialLinks, upworkedSocialLinks } from '../../Constants';
import { textBlinkAnimation } from '../../animations/textBlinkAnimation';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';
import { isUpwork } from '../../config';
import { textBlinkAnimateByWord } from '../../animations/textBlinkAnimateByWord';
import { useMichibotInteraction } from '../../hooks/useMichibotInteraction';

const Scene = lazy(() => import('./bot/Scene'));

const supportsWebGL = () => {
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const contextOptions = { failIfMajorPerformanceCaveat: true };
    const context =
      canvas.getContext('webgl2', contextOptions) ||
      canvas.getContext('webgl', contextOptions) ||
      canvas.getContext('experimental-webgl', contextOptions);

    if (!context) return false;

    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
};

const BotPlaceholder = () => (
  <div className='w-full h-full' aria-hidden='true' />
);

const Hero = () => {
  const nameTitleRef = useRef(null);
  const developerTitleRef = useRef(null);
  const countryRef = useRef(null);
  const passionRef = useRef(null);
  const heroRef = useRef(null);
  const botContainerRef = useRef(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [sceneStatus, setSceneStatus] = useState('checking');

  const {
    isActive,
    isDesktop,
    isLoaded,
    prefersReducedMotion,
    setIsLoaded,
    handleClick,
  } = useMichibotInteraction(botContainerRef, heroRef);

  const handleSceneLoad = useCallback(() => {
    setIsLoaded(true);
  }, [setIsLoaded]);

  useEffect(() => {
    const animationHandles = [];

    if (nameTitleRef.current) {
      const handle = textBlinkAnimateByWord(nameTitleRef.current);
      if (handle) animationHandles.push(handle);
    }
    if (developerTitleRef.current) {
      const handle = textBlinkAnimation(developerTitleRef.current);
      if (handle) animationHandles.push(handle);
    }
    if (heroRef.current) {
      if (countryRef.current) {
        const handle = wordBlinkAnimation(
          countryRef.current,
          null,
          heroRef.current,
          true
        );
        if (handle) animationHandles.push(handle);
      }
      if (passionRef.current) {
        const handle = wordBlinkAnimation(
          passionRef.current,
          null,
          heroRef.current,
          true
        );
        if (handle) animationHandles.push(handle);
      }
    }

    return () => animationHandles.forEach((handle) => handle.kill());
  }, []);

  useEffect(() => {
    // The decorative model is intentionally desktop-only and motion-sensitive.
    // Avoid downloading ~2 MB of deferred 3D code/assets for mobile and
    // reduced-motion users who cannot use the interaction.
    if (!isDesktop || prefersReducedMotion || !supportsWebGL()) {
      setSceneStatus('unavailable');
      return undefined;
    }

    setSceneStatus('waiting');

    const showScene = () => setSceneStatus('ready');
    let idleCallbackId;
    let fallbackTimerId;

    if (typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(showScene, {
        timeout: 2000,
      });
    } else {
      fallbackTimerId = window.setTimeout(showScene, 1200);
    }

    return () => {
      if (
        idleCallbackId !== undefined &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (fallbackTimerId !== undefined) {
        window.clearTimeout(fallbackTimerId);
      }
    };
  }, [isDesktop, prefersReducedMotion]);

  return (
    <div
      ref={heroRef}
      className='min-h-screen body-max-width sec-inner-x-padding grid items-stretch gap-4 w-full pt-[160px] pb-2'
    >
      <div className='flex relative items-center justify-between w-full'>
        <p
          ref={countryRef}
          className='hidden sm:inline sm:text-[10px] md:text-xs text-montreal-mono text-muted-light uppercase pointer-all'
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
            <button
              type='button'
              ref={botContainerRef}
              aria-label='Toggle the interactive Michi Bot'
              aria-pressed={isActive}
              disabled={!isDesktop || !isLoaded || prefersReducedMotion}
              className={`pointer-all absolute w-[350px] h-[300px] left-[100%] -translate-x-1/2 transition-all duration-300 disabled:pointer-events-none ${
                isDesktop && isLoaded ? 'cursor-pointer' : ''
              } ${isActive ? 'z-50 michibot-active' : 'z-40'}`}
              onClick={handleClick}
              onMouseEnter={() =>
                isDesktop && isLoaded && !isActive && setShowTooltip(true)
              }
              onMouseLeave={() => setShowTooltip(false)}
            >
              {isDesktop && isLoaded && !isActive && (
                <div
                  className={`michibot-tooltip ${showTooltip ? 'show' : ''}`}
                >
                  <span className='highlight-text'>Click</span> me to see magic!
                  ✨
                </div>
              )}
              {sceneStatus === 'ready' ? (
                <Suspense fallback={<BotPlaceholder />}>
                  <Scene onLoad={handleSceneLoad} isActive={isActive} />
                </Suspense>
              ) : (
                <BotPlaceholder />
              )}
            </button>
          </div>
        </div>
        <p
          ref={passionRef}
          className='hidden sm:inline sm:text-[11px] text-xs text-montreal-mono text-muted-light uppercase pointer-all'
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
