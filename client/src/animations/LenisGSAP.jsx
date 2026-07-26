import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ReactLenis } from 'lenis/react';
import { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import useTextRevealAnimation from './useTextRevealAnimation';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

gsap.registerPlugin(ScrollTrigger);

export function LenisGSAP({ children }) {
  const lenisRef = useRef();
  const prefersReducedMotion = usePrefersReducedMotion();
  useTextRevealAnimation('text-letter-reveal');

  const lenisOptions = useMemo(
    () => ({
      lerp: 0.1,
      duration: 1.5,
      syncTouch: true,
      smoothWheel: true,
      autoRaf: false,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    }),
    []
  );

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    function update(time) {
      lenisRef.current?.lenis?.raf(time * 1000);
    }

    gsap.ticker.add(update);

    return () => gsap.ticker.remove(update);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return <>{children}</>;

  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={lenisOptions}
    >
      {children}
    </ReactLenis>
  );
}

LenisGSAP.propTypes = {
  children: PropTypes.node.isRequired,
};
