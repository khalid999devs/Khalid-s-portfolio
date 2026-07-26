import { useEffect, useRef } from 'react';
import { handleImageFallback } from '../../utils/imageFallback';
import { reqFileWrapper } from '../../axios/requests';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

gsap.registerPlugin(ScrollTrigger);

const ProjectSlider = ({ sliderContents }) => {
  const sliderRef = useRef(null);
  const containerRef = useRef(null);
  const scrollTriggerRef = useRef(null);
  const location = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const slider = sliderRef.current;
    const container = containerRef.current;

    if (!slider || !container || prefersReducedMotion) return undefined;

    const mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', () => {
      const totalWidth = slider.scrollWidth - container.offsetWidth;

      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
        scrollTriggerRef.current = null;
      }

      if (!Number.isFinite(totalWidth) || totalWidth <= 0) {
        gsap.set(slider, { x: 0 });
        return undefined;
      }

      const scrollTween = gsap.to(slider, {
        x: -totalWidth,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: () => `+=${totalWidth}`,
          pin: true,
          pinSpacing: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      scrollTriggerRef.current = scrollTween.scrollTrigger;

      return () => {
        if (scrollTriggerRef.current) {
          scrollTriggerRef.current.kill();
          scrollTriggerRef.current = null;
        }
      };
    });

    return () => {
      mm.revert();
    };
  }, [
    sliderContents,
    location.pathname,
    prefersReducedMotion,
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full sec-x-padding mt-20 relative flex items-center ${
        prefersReducedMotion
          ? 'overflow-visible min-h-0'
          : 'overflow-hidden min-h-0 md:min-h-screen'
      }`}
    >
      <div
        ref={sliderRef}
        className={`w-full gap-4 md:gap-3.5 lg:gap-4 overflow-visible pointer-all ${
          prefersReducedMotion
            ? 'grid grid-cols-1'
            : 'flex flex-col md:flex-row'
        }`}
      >
        {sliderContents?.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-[18px] h-auto shrink-0 pointer-all overflow-hidden bg-body-main ${
              prefersReducedMotion
                ? 'w-full'
                : 'w-full md:max-w-[98%] lg:max-w-[80%]'
            }`}
          >
            <a
              href={reqFileWrapper(item?.url)}
              target='_blank'
              rel='noopener noreferrer'
              aria-label={`Open project image ${index + 1} at full size`}
              className='block'
            >
              <img
                src={reqFileWrapper(item?.url)}
                width={item.width}
                height={item.height}
                className='w-full h-auto rounded-[18px] max-h-[85vh] cursor-pointer transition-all duration-1000 hover:scale-[101%]'
                alt={item.alt || `Project detail ${index + 1}`}
                onError={handleImageFallback}
                loading='lazy'
                decoding='async'
              />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

ProjectSlider.propTypes = {
  sliderContents: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string,
      alt: PropTypes.string,
      width: PropTypes.number,
      height: PropTypes.number,
    })
  ),
};

export default ProjectSlider;
