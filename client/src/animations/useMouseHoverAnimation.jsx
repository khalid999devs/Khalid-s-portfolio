import { useEffect } from 'react';
import gsap from 'gsap';

export function useMouseHoverAnimation() {
  useEffect(() => {
    const className = 'mouse-hover-glitch';
    const elements = document.querySelectorAll(`.${className}`);
    if (!elements.length) return;

    elements.forEach((element) => {
      element.addEventListener('mouseenter', () => {
        gsap.to(element.querySelectorAll('span'), {
          opacity: 0.3,
          filter: 'contrast(2) brightness(1.5) hue-rotate(20deg)',
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
          duration: 0.1,
          repeat: 5,
          yoyo: true,
          ease: 'power3.inOut',
          onComplete: () => {
            gsap.to(element.querySelectorAll('span'), {
              opacity: 1,
              filter: 'contrast(1) brightness(1) hue-rotate(0deg)',
              x: 0,
              y: 0,
              duration: 0.5,
              ease: 'power3.out',
            });
          },
        });
      });

      element.addEventListener('mouseleave', () => {
        gsap.to(element.querySelectorAll('span'), {
          opacity: 1,
          filter: 'contrast(1) brightness(1)',
          x: 0,
          y: 0,
          duration: 0.5,
          ease: 'power3.inOut',
        });
      });
    });

    return () => {
      elements.forEach((element) => {
        element.removeEventListener('mouseenter', () => {});
        element.removeEventListener('mouseleave', () => {});
      });
    };
  }, []);
}
