import { useState, useRef, useEffect } from 'react';
import { reqFileWrapper } from '../../axios/requests';
import PropTypes from 'prop-types';

// The fragment makes iOS draw the first frame of a video that has not played yet.
const FIRST_FRAME = '#t=0.001';

const ProjectVideos = ({ videos }) => {
  const videoRefs = useRef([]);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  useEffect(() => {
    const elements = videoRefs.current.filter(Boolean);
    if (!elements.length || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    // Buffering starts a screen ahead, so a video is ready when it comes into view.
    const approach = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ isIntersecting, target }) => {
          if (!isIntersecting) return;
          target.preload = 'auto';
          approach.unobserve(target);
        });
      },
      { rootMargin: '100% 0px' }
    );

    // Plays while any part is in view. Follows the element itself, so content
    // above that loads late and changes height cannot leave it out of step.
    const visibility = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ isIntersecting, target }) => {
          // A refused or interrupted play is not an error.
          if (isIntersecting) target.play()?.catch(() => {});
          else target.pause();
        });
      },
      { rootMargin: '0px 0px 10% 0px' }
    );

    elements.forEach((video) => {
      approach.observe(video);
      visibility.observe(video);
    });

    return () => {
      approach.disconnect();
      visibility.disconnect();
    };
  }, [videos]);

  return (
    <div className='w-full grid grid-cols-1 gap-16 md:gap-20 sec-project-x-padding'>
      {videos?.map((video, key) => (
        <video
          key={video.id ?? key}
          ref={(el) => {
            videoRefs.current[key] = el;
          }}
          src={`${reqFileWrapper(video.url)}${FIRST_FRAME}`}
          width={video.width}
          height={video.height}
          className='w-full max-h-[95vh] object-cover h-auto transition-transform duration-500 ease-out transform pointer-all'
          loop
          muted
          playsInline
          preload='metadata'
          controls={hoveredIndex === key}
          controlsList='nodownload'
          onMouseEnter={() => setHoveredIndex(key)}
          onMouseLeave={() => setHoveredIndex(null)}
        ></video>
      ))}
    </div>
  );
};

ProjectVideos.propTypes = {
  videos: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      url: PropTypes.string,
      width: PropTypes.number,
      height: PropTypes.number,
    })
  ),
};

export default ProjectVideos;
