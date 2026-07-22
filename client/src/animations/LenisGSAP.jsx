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
      lerp: prefersReducedMotion ? 1 : 0.1,
      duration: prefersReducedMotion ? 0 : 1.5,
      syncTouch: !prefersReducedMotion,
      smoothWheel: !prefersReducedMotion,
      autoRaf: false,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    }),
    [prefersReducedMotion]
  );

  useEffect(() => {
    function update(time) {
      lenisRef.current?.lenis?.raf(time * 1000);
    }

    gsap.ticker.add(update);

    return () => gsap.ticker.remove(update);
  }, []);

  // Refresh ScrollTrigger when route changes
  // useEffect(() => {
  //   setTimeout(() => {
  //     ScrollTrigger.refresh();
  //   }, 100); // Small delay to ensure new content loads
  //   }, [location.pathname]); // Runs on route change

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
