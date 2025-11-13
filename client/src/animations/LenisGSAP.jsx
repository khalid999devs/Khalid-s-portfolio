import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ReactLenis } from 'lenis/react';
import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import useTextRevealAnimation from './useTextRevealAnimation';

gsap.registerPlugin(ScrollTrigger);

export function LenisGSAP({ children }) {
  const lenisRef = useRef();
  useTextRevealAnimation('text-letter-reveal');

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
      options={{
        lerp: 0.1,
        duration: 1.5,
        syncTouch: true,
        smoothWheel: true,
        autoRaf: false,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      }}
    >
      {children}
    </ReactLenis>
  );
}

LenisGSAP.propTypes = {
  children: PropTypes.node.isRequired,
};
