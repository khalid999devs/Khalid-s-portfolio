import { useState, useEffect, useCallback, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createFollower } from '../components/Home/bot/flight';

gsap.registerPlugin(ScrollTrigger);

export const useMichibotInteraction = (containerRef, heroSectionRef) => {
  const [isActive, setIsActive] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const followerRef = useRef(null);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  useEffect(() => {
    const follower = createFollower(containerRef.current);
    followerRef.current = follower;
    return () => follower.destroy();
  }, [containerRef]);

  // Once it follows the pointer, the next click anywhere, Escape, or scrolling
  // past the hero sends it home.
  useEffect(() => {
    if (!isActive) return undefined;

    const release = () => setIsActive(false);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') release();
    };

    window.addEventListener('pointerdown', release);
    window.addEventListener('keydown', onKeyDown);
    const leftHero = ScrollTrigger.create({
      trigger: heroSectionRef.current,
      start: 'bottom 80%',
      end: 'bottom top',
      onLeave: release,
    });

    return () => {
      window.removeEventListener('pointerdown', release);
      window.removeEventListener('keydown', onKeyDown);
      leftHero.kill();
      followerRef.current?.release();
    };
  }, [isActive, heroSectionRef]);

  const handleClick = useCallback(
    (event) => {
      if (!isDesktop || !isLoaded || isActive) return;

      followerRef.current?.follow(event.nativeEvent);
      setIsActive(true);
    },
    [isDesktop, isLoaded, isActive]
  );

  return {
    isActive,
    isDesktop,
    isLoaded,
    setIsLoaded,
    handleClick,
  };
};
