import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { socialLinks, upworkedSocialLinks } from '../../Constants';
import { textBlinkAnimation } from '../../animations/textBlinkAnimation';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';
import { isUpwork } from '../../config';
import { textBlinkAnimateByWord } from '../../animations/textBlinkAnimateByWord';
import { useMichibotInteraction } from '../../hooks/useMichibotInteraction';
import { MainRobotImg } from '../../assets';
import useSceneCapability from '../../hooks/useSceneCapability';

const Scene = lazy(() => import('./bot/Scene'));

const RobotFallback = () => (
  <div
    className='flex h-full w-full items-center justify-center'
    aria-hidden='true'
  >
    <img
      src={MainRobotImg}
      width='146'
      height='193'
      alt=''
      className='h-[193px] w-[146px] object-contain'
      decoding='async'
      fetchPriority='high'
    />
  </div>
);

const Hero = () => {
  const nameTitleRef = useRef(null);
  const developerTitleRef = useRef(null);
  const countryRef = useRef(null);
  const passionRef = useRef(null);
  const heroRef = useRef(null);
  const botContainerRef = useRef(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [sceneRequested, setSceneRequested] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneAttempt, setSceneAttempt] = useState(0);

  const {
    isActive,
    isDesktop,
    isLoaded,
    prefersReducedMotion,
    setIsLoaded,
    handleClick,
  } = useMichibotInteraction(botContainerRef, heroRef);
  const sceneCapability = useSceneCapability({
    isDesktop,
    prefersReducedMotion,
  });
  const isSceneLoading = sceneRequested && !isLoaded && !sceneFailed;

  const handleSceneLoad = useCallback(() => {
    setSceneFailed(false);
    setIsLoaded(true);
  }, [setIsLoaded]);

  const handleSceneError = useCallback(() => {
    setSceneFailed(true);
    setIsLoaded(false);
  }, [setIsLoaded]);

  const handleBotClick = useCallback(() => {
    if (!sceneCapability.eligible || isSceneLoading) return;

    if (!sceneRequested || sceneFailed) {
      setSceneFailed(false);
      setIsLoaded(false);
      setSceneRequested(true);
      setSceneAttempt((attempt) => attempt + 1);
      return;
    }

    handleClick();
  }, [
    handleClick,
    isSceneLoading,
    sceneCapability.eligible,
    sceneFailed,
    sceneRequested,
    setIsLoaded,
  ]);

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
    if (sceneCapability.eligible) return;

    setSceneRequested(false);
    setSceneFailed(false);
    setIsLoaded(false);
    setShowTooltip(false);
  }, [sceneCapability.eligible, setIsLoaded]);

  const botActionLabel = !sceneCapability.eligible
    ? 'Interactive 3D Michi Bot is unavailable on this device'
    : sceneFailed
    ? 'Retry loading the interactive 3D Michi Bot'
    : !sceneRequested
    ? 'Enable the interactive 3D Michi Bot'
    : isSceneLoading
    ? 'Loading the interactive 3D Michi Bot'
    : 'Toggle the interactive Michi Bot';

  const tooltipText = sceneFailed
    ? 'Retry 3D'
    : sceneRequested
    ? 'Click me to see magic! ✨'
    : 'Enable interactive 3D';

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
              aria-label={botActionLabel}
              aria-pressed={isLoaded ? isActive : undefined}
              aria-busy={isSceneLoading}
              aria-disabled={isSceneLoading || undefined}
              disabled={!sceneCapability.eligible}
              className={`pointer-all absolute w-[350px] h-[300px] left-[100%] -translate-x-1/2 transition-all duration-300 disabled:pointer-events-none ${
                sceneCapability.eligible && !isSceneLoading
                  ? 'cursor-pointer'
                  : ''
              } ${isActive ? 'z-50 michibot-active' : 'z-40'}`}
              onClick={handleBotClick}
              onMouseEnter={() =>
                sceneCapability.eligible &&
                !isSceneLoading &&
                !isActive &&
                setShowTooltip(true)
              }
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() =>
                sceneCapability.eligible &&
                !isSceneLoading &&
                !isActive &&
                setShowTooltip(true)
              }
              onBlur={() => setShowTooltip(false)}
            >
              {sceneCapability.eligible && !isSceneLoading && !isActive && (
                <div
                  className={`michibot-tooltip ${showTooltip ? 'show' : ''}`}
                >
                  <span className='highlight-text'>
                    {sceneFailed ? 'Retry' : sceneRequested ? 'Click' : 'Enable'}
                  </span>{' '}
                  {tooltipText.replace(/^(Retry|Click|Enable)\s*/u, '')}
                </div>
              )}
              {sceneRequested ? (
                <Suspense fallback={<RobotFallback />}>
                  <Scene
                    key={sceneAttempt}
                    fallback={<RobotFallback />}
                    onError={handleSceneError}
                    onLoad={handleSceneLoad}
                    isActive={isActive}
                  />
                </Suspense>
              ) : (
                <RobotFallback />
              )}
            </button>
            <span className='sr-only' role='status' aria-live='polite'>
              {isSceneLoading
                ? 'Loading interactive 3D model.'
                : sceneFailed
                ? 'The interactive 3D model could not be loaded.'
                : ''}
            </span>
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
