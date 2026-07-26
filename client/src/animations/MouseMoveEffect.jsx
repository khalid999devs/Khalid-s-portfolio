import { useEffect, useRef } from 'react';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

const MouseMoveEffect = () => {
  const gridRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const supportsFinePointer =
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(pointer: fine)').matches;
    if (!supportsFinePointer || prefersReducedMotion) {
      grid.style.setProperty('--cursor-grid-opacity', '0');
      return undefined;
    }

    let animationFrameId;
    let fadeTimerId;
    let pendingX = 0;
    let pendingY = 0;

    const updateGrid = () => {
      animationFrameId = undefined;
      grid.style.setProperty('--cursor-grid-x', `${pendingX}px`);
      grid.style.setProperty('--cursor-grid-y', `${pendingY}px`);
      grid.style.setProperty('--cursor-grid-opacity', '1');
      window.clearTimeout(fadeTimerId);
      fadeTimerId = window.setTimeout(() => {
        grid.style.setProperty('--cursor-grid-opacity', '0');
      }, 500);
    };

    const handlePointerMove = (event) => {
      pendingX = event.clientX;
      pendingY = event.clientY;
      if (animationFrameId === undefined) {
        animationFrameId = window.requestAnimationFrame(updateGrid);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.clearTimeout(fadeTimerId);
      grid.style.setProperty('--cursor-grid-opacity', '0');
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={gridRef}
      aria-hidden='true'
      className='cursor-grid pointer-events-none fixed inset-0 overflow-hidden'
    />
  );
};

export default MouseMoveEffect;
