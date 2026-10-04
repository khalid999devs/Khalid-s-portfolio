import { useEffect, useRef, useState } from 'react';
import { reqFileWrapper } from '../../axios/requests';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PropTypes from 'prop-types';

gsap.registerPlugin(ScrollTrigger);

// How long the layout must hold still before the pin is measured again.
const SETTLE_MS = 150;

// The width the slide takes once its image has loaded, so the row is already
// its final length. Matches the image's own `max-h-[85vh]`.
const reservedWidth = ({ width, height }) =>
  width && height
    ? { width: `min(${width}px, calc(85vh * ${width} / ${height}))` }
    : undefined;

const openFull = (url) => window.open(reqFileWrapper(url), '_blank');

const WideSlide = ({ item, eager }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className='max-w-[98%] lg:max-w-[80%] rounded-[18px] h-auto shrink-0 pointer-all overflow-hidden bg-body-main'
      style={loaded ? undefined : reservedWidth(item)}
    >
      <img
        src={reqFileWrapper(item.url)}
        width={item.width}
        height={item.height}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        className='w-full h-auto rounded-[18px] max-h-[85vh] cursor-pointer transition-all duration-1000 hover:scale-[101%]'
        alt='Project Slide'
        title='Click to view in full screen'
        onClick={() => openFull(item.url)}
      />
    </div>
  );
};

const ProjectSlider = ({ sliderContents }) => {
  const sliderRef = useRef(null);
  const containerRef = useRef(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const slider = sliderRef.current;
    const container = containerRef.current;
    if (!slider || !container) return undefined;

    const mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', () => {
      const distance = () => slider.scrollWidth - container.offsetWidth;

      const tween = gsap.to(slider, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          pinSpacing: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // A slide that loads late changes the distance, and anything above that
      // changes height moves the start.
      let settle;
      const layout = new ResizeObserver(() => {
        clearTimeout(settle);
        settle = setTimeout(() => tween.scrollTrigger?.refresh(), SETTLE_MS);
      });
      layout.observe(document.body);
      Array.from(slider.children).forEach((slide) => layout.observe(slide));

      // Slides off to the right are clipped, so lazy loading would fetch each
      // one only as it slid into view. They load together ahead of the section.
      const approach = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          setNear(true);
          approach.disconnect();
        },
        { rootMargin: '200% 0px' }
      );
      approach.observe(container);

      return () => {
        clearTimeout(settle);
        layout.disconnect();
        approach.disconnect();
      };
    });

    return () => mm.revert();
  }, [sliderContents]);

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
          <WideSlide key={item.id} item={item} eager={near} />
        ))}
      </div>

      {/* Separate slider for mobile screens */}
      <div className='flex md:hidden w-full flex-col gap-4 overflow-visible pointer-all'>
        {sliderContents?.map((item) => (
          <div
            key={item.id}
            className='w-full rounded-[18px] h-auto shrink-0 pointer-all overflow-hidden bg-body-main'
          >
            <img
              src={reqFileWrapper(item.url)}
              width={item.width}
              height={item.height}
              loading='lazy'
              decoding='async'
              className='w-full h-auto rounded-[18px] max-h-[85vh] cursor-pointer transition-all duration-500 hover:scale-[102%]'
              alt='Project Slide'
              title='Click to view in full screen'
              onClick={() => openFull(item.url)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const slide = PropTypes.shape({
  id: PropTypes.string,
  url: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
});

WideSlide.propTypes = {
  item: slide.isRequired,
  eager: PropTypes.bool,
};

ProjectSlider.propTypes = {
  sliderContents: PropTypes.arrayOf(slide),
};

export default ProjectSlider;
