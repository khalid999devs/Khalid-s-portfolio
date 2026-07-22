import { useRef, useEffect } from 'react';
import { reqFileWrapper } from '../../axios/requests';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PropTypes from 'prop-types';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

gsap.registerPlugin(ScrollTrigger);

const ProjectVideos = ({ videos }) => {
  const videoRefs = useRef([]);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const videoElements = videoRefs.current
      .slice(0, videos?.length || 0)
      .filter(Boolean);

    const pauseVideo = (video) => video.pause();
    const playVideo = (video) => {
      const playPromise = video.play();
      playPromise?.catch?.(() => {
        // Autoplay can still be denied by browser or OS policy. The always-
        // visible controls remain available as the accessible fallback.
      });
    };

    if (prefersReducedMotion) {
      videoElements.forEach(pauseVideo);
      return () => videoElements.forEach(pauseVideo);
    }

    const triggers = videoElements.map((video) => {
      if (!video) return null;

      return ScrollTrigger.create({
        trigger: video,
        start: '-10% bottom',
        onEnter: () => playVideo(video),
        onLeave: () => pauseVideo(video),
        onEnterBack: () => playVideo(video),
        onLeaveBack: () => pauseVideo(video),
      });
    });

    return () => {
      triggers.forEach((trigger) => trigger?.kill());
      videoElements.forEach(pauseVideo);
    };
  }, [prefersReducedMotion, videos]);

  return (
    <div className='w-full grid grid-cols-1 gap-16 md:gap-20 sec-project-x-padding'>
      {videos?.map((video, key) => (
        <video
          key={key}
          ref={(el) => (videoRefs.current[key] = el)}
          src={reqFileWrapper(video.url)}
          className='w-full max-h-[95vh] object-cover h-auto transition-transform duration-500 ease-out transform pointer-all'
          loop
          muted
          playsInline
          controls
          preload='metadata'
          controlsList='nodownload'
          aria-label={video.alt || `Project video ${key + 1}`}
        ></video>
      ))}
    </div>
  );
};


ProjectVideos.propTypes = {
  videos: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string,
      alt: PropTypes.string,
    })
  ),
};

export default ProjectVideos;
