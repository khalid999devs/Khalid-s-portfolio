import React, { useEffect, useRef } from 'react';
import { reqFileWrapper } from '../../axios/requests';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import useDocumentHeight from '../../hooks/useDocumentHeight';

gsap.registerPlugin(ScrollTrigger);

const ProjectSlider = ({ sliderContents }) => {
  const sliderRef = useRef(null);
  const containerRef = useRef(null);
  const scrollTriggerRef = useRef(null);

  const documentHeight = useDocumentHeight(); // Still used, but NOT in dependency array

  useEffect(() => {
    const slider = sliderRef.current;
    const container = containerRef.current;

    if (!slider || !container) return;

    const updateSlider = () => {
      let totalWidth = slider.scrollWidth - container.offsetWidth;

      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill(); // Kill previous instance
      }

      const scrollTween = gsap.to(slider, {
        x: -totalWidth,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: () => `+=${totalWidth}`,
          pin: true,
          markers: true,
          scrub: 1,
          anticipatePin: 1.5,
        },
      });

      scrollTriggerRef.current = scrollTween.scrollTrigger;
    };

    updateSlider(); // Initial setup

    // Handle layout changes
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
  }, [sliderContents]); // ❌ documentHeight REMOVED from dependencies

  // 🔹 Instead, trigger GSAP refresh when height changes
  useEffect(() => {
    // gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    ScrollTrigger.refresh();
  }, [documentHeight]);

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
