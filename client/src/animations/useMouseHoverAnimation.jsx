import { useEffect } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from '../utils/motionPreferences';

export function useMouseHoverAnimation() {
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    const className = 'mouse-hover-glitch';
    const elements = document.querySelectorAll(`.${className}`);
    if (!elements.length) return;

    const listeners = [];

    elements.forEach((element) => {
      const spans = element.querySelectorAll('span');
      const handleMouseEnter = () => {
        gsap.killTweensOf(spans);
        gsap.to(spans, {
          opacity: 0.3,
          filter: 'contrast(2) brightness(1.5) hue-rotate(20deg)',
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
          duration: 0.1,
          repeat: 5,
          yoyo: true,
          ease: 'power3.inOut',
          onComplete: () => {
            gsap.to(spans, {
              opacity: 1,
              filter: 'contrast(1) brightness(1) hue-rotate(0deg)',
              x: 0,
              y: 0,
              duration: 0.5,
              ease: 'power3.out',
            });
          },
        });
      };

      const handleMouseLeave = () => {
        gsap.killTweensOf(spans);
        gsap.to(spans, {
          opacity: 1,
          filter: 'contrast(1) brightness(1)',
          x: 0,
          y: 0,
          duration: 0.5,
          ease: 'power3.inOut',
        });
      };

      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
      listeners.push({ element, handleMouseEnter, handleMouseLeave, spans });
    });

    return () => {
      listeners.forEach(
        ({ element, handleMouseEnter, handleMouseLeave, spans }) => {
          element.removeEventListener('mouseenter', handleMouseEnter);
          element.removeEventListener('mouseleave', handleMouseLeave);
          gsap.killTweensOf(spans);
          gsap.set(spans, {
            opacity: 1,
            filter: 'none',
            x: 0,
            y: 0,
          });
        }
      );
    };
  }, []);
}
