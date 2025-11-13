import { useEffect, useRef } from 'react';
import { reqFileWrapper } from '../../axios/requests';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocation } from 'react-router-dom';
import useDocumentHeight from '../../hooks/useDocumentHeight';
import PropTypes from 'prop-types';

gsap.registerPlugin(ScrollTrigger);

const ProjectSlider = ({ sliderContents }) => {
  const sliderRef = useRef(null);
  const containerRef = useRef(null);
  const documentHeight = useDocumentHeight();
  const scrollTriggerRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const slider = sliderRef.current;
    const container = containerRef.current;

    if (!slider || !container) return;

    let mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', () => {
      const totalWidth = slider.scrollWidth - container.offsetWidth;

      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
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
  }, [sliderContents, documentHeight, location.pathname]);

  return (
    <div
      ref={containerRef}
      className='w-full overflow-hidden sec-x-padding min-h-screen mt-20 relative flex items-center'
    >
      {/* Slider for md and larger screens */}
      <div
        ref={sliderRef}
        className='hidden md:flex w-full flex-row gap-2 md:gap-3.5 lg:gap-4 overflow-visible pointer-all'
      >
        {sliderContents?.map((item) => (
          <div
            key={item.id}
            className='max-w-[98%] lg:max-w-[80%] rounded-[18px] h-auto flex-shrink-0 pointer-all overflow-hidden bg-body-main'
          >
            <img
              src={reqFileWrapper(item?.url)}
              className='w-full h-auto rounded-[18px] max-h-[85vh] cursor-pointer transition-all duration-1000 hover:scale-[101%]'
              alt='Project Slide'
              title='Click to view in full screen'
              onClick={() => {
                window.open(reqFileWrapper(item?.url), '_blank');
              }}
            />
          </div>
        ))}
      </div>

      {/* Separate slider for mobile screens */}
      <div className='flex md:hidden w-full flex-col gap-4 overflow-visible pointer-all'>
        {sliderContents?.map((item) => (
          <div
            key={item.id}
            className='w-full rounded-[18px] h-auto flex-shrink-0 pointer-all overflow-hidden bg-body-main'
          >
            <img
              src={reqFileWrapper(item?.url)}
              className='w-full h-auto rounded-[18px] max-h-[85vh] cursor-pointer transition-all duration-500 hover:scale-[102%]'
              alt='Project Slide'
              title='Click to view in full screen'
              onClick={() => {
                window.open(reqFileWrapper(item?.url), '_blank');
              }}
            />
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
    })
  ),
};

export default ProjectSlider;
