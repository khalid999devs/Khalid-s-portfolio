import { useState, useEffect, useCallback, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const useMichibotInteraction = (containerRef, heroSectionRef) => {
  const [isActive, setIsActive] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const mousePos = useRef({ x: 0, y: 0 });
  const botPos = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef(null);
  const scrollTriggerInstance = useRef(null);
  const LERP = 0.15;

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  const handleMouseMove = useCallback(
    (e) => {
      if (!isActive || !isDesktop) return;
      mousePos.current = { x: e.clientX, y: e.clientY };
    },
    [isActive, isDesktop]
  );

  const animate = useCallback(() => {
    if (!isActive || !containerRef.current) return;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const targetX = mousePos.current.x - centerX;
    const targetY = mousePos.current.y - centerY;

    const dx = targetX - botPos.current.x;
    const dy = targetY - botPos.current.y;

    botPos.current.x += dx * LERP;
    botPos.current.y += dy * LERP;

    gsap.set(containerRef.current, {
      x: botPos.current.x,
      y: botPos.current.y,
      rotation: dx * 0.01,
      force3D: true,
    });

    animationFrameId.current = requestAnimationFrame(animate);
  }, [isActive, containerRef]);

  useEffect(() => {
    if (isActive && isDesktop) {
      animate();
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isActive, animate, handleMouseMove, isDesktop]);

  useEffect(() => {
    if (!heroSectionRef?.current || !containerRef.current || !isDesktop) return;

    scrollTriggerInstance.current = ScrollTrigger.create({
      trigger: heroSectionRef.current,
      start: 'bottom 80%',
      end: 'bottom top',
      onLeave: () => {
        if (isActive) {
          if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
          }

          setIsActive(false);

          gsap.to(containerRef.current, {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 0.8,
            ease: 'power3.out',
            onComplete: () => {
              botPos.current = { x: 0, y: 0 };
              mousePos.current = { x: 0, y: 0 };
            },
          });
        }
      },
    });

    return () => {
      if (scrollTriggerInstance.current) {
        scrollTriggerInstance.current.kill();
      }
    };
  }, [heroSectionRef, containerRef, isActive, isDesktop]);

  const handleClick = useCallback(() => {
    if (!isDesktop || !isLoaded) return;

    setIsActive((prev) => {
      const newState = !prev;

      if (!newState) {
        gsap.to(containerRef.current, {
          x: 0,
          y: 0,
          rotation: 0,
          duration: 0.6,
          ease: 'power2.out',
          onComplete: () => {
            botPos.current = { x: 0, y: 0 };
            mousePos.current = { x: 0, y: 0 };
          },
        });
      } else {
        gsap.fromTo(
          containerRef.current,
          { scale: 1 },
          {
            scale: 1.1,
            duration: 0.15,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut',
          }
        );
      }

      return newState;
    });
  }, [isDesktop, isLoaded, containerRef]);

  return {
    isActive,
    isDesktop,
    isLoaded,
    setIsLoaded,
    handleClick,
  };
};
