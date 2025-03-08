import React, { useEffect, useRef } from 'react';
import { reqFileWrapper } from '../../axios/requests';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const ProjectSlider = ({ sliderContents }) => {
  const sliderRef = useRef(null);
  const containerRef = useRef(null);
  const scrollTriggerRef = useRef(null);

  useEffect(() => {
    const slider = sliderRef.current;
    const container = containerRef.current;

    if (!slider || !container) return;

    const updateSlider = () => {
      // Get total scrollable width
      const totalWidth = slider.scrollWidth - container.offsetWidth;

      // Kill previous ScrollTrigger instance if exists
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
      }

      // Set up GSAP horizontal scroll effect
      const scrollTween = gsap.to(slider, {
        x: -totalWidth,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: () => `+=${totalWidth}`, // Dynamically set end
          pin: true,
          pinSpacing: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      scrollTriggerRef.current = scrollTween.scrollTrigger;
    };

    updateSlider(); // Initial setup

    const handleResize = () => {
      gsap.delayedCall(0.2, () => {
        updateSlider();
        ScrollTrigger.refresh();
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (scrollTriggerRef.current) scrollTriggerRef.current.kill();
    };
  }, [sliderContents]);

  return (
    <div
      ref={containerRef}
      className='w-full overflow-hidden sec-x-padding min-h-screen mt-20 relative flex items-center'
    >
      <div
        ref={sliderRef}
        className='flex w-full flex-row gap-2 ms:gap-3.5 lg:gap-4 overflow-visible pointer-all'
      >
        {sliderContents?.map((item) => (
          <div
            key={item.id}
            className='max-w-[98%] lg:max-w-[80%] h-auto flex-shrink-0 pointer-all'
          >
            <img
              src={reqFileWrapper(item?.url)}
              className='w-full h-auto rounded-[18px] max-h-[85vh]'
              alt='Project Slide'
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectSlider;
