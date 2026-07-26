import { useEffect, useRef, useState } from 'react';
import { reqFileWrapper } from '../../axios/requests';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PropTypes from 'prop-types';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { getNetworkConnection } from '../../utils/sceneCapability';

gsap.registerPlugin(ScrollTrigger);

const VIDEO_LOAD_MARGIN = '600px 0px';

const getSaveDataPreference = () => {
  if (typeof navigator === 'undefined') return false;
  return getNetworkConnection(navigator)?.saveData === true;
};

const useSaveDataPreference = () => {
  const [saveData, setSaveData] = useState(getSaveDataPreference);

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;

    const connection = getNetworkConnection(navigator);
    if (!connection) return undefined;

    const updatePreference = () => {
      setSaveData(connection.saveData === true);
    };

    updatePreference();
    connection.addEventListener?.('change', updatePreference);

    return () => {
      connection.removeEventListener?.('change', updatePreference);
    };
  }, []);

  return saveData;
};

const LazyProjectVideo = ({ allowAutoplay, index, video }) => {
  const videoRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const source = reqFileWrapper(video.url);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !source) return undefined;

    if (
      typeof window === 'undefined' ||
      typeof window.IntersectionObserver !== 'function'
    ) {
      setShouldLoad(true);
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        setShouldLoad(true);
        observer.disconnect();
      },
      {
        rootMargin: VIDEO_LOAD_MARGIN,
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [source]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !source || !shouldLoad) return undefined;

    const pauseVideo = () => element.pause();
    const playVideo = () => {
      const playPromise = element.play();
      playPromise?.catch?.(() => {
        // Autoplay can still be denied by browser or OS policy. The always-
        // visible controls remain available as the accessible fallback.
      });
    };

    if (!allowAutoplay) {
      pauseVideo();
      return pauseVideo;
    }

    const trigger = ScrollTrigger.create({
      trigger: element,
      start: '-10% bottom',
      onEnter: playVideo,
      onLeave: pauseVideo,
      onEnterBack: playVideo,
      onLeaveBack: pauseVideo,
    });

    return () => {
      trigger?.kill();
      pauseVideo();
    };
  }, [allowAutoplay, shouldLoad, source]);

  return (
    <video
      ref={videoRef}
      src={shouldLoad ? source : undefined}
      className='w-full max-h-[95vh] object-cover h-auto transition-transform duration-500 ease-out transform pointer-all'
      loop
      muted
      playsInline
      controls
      preload='none'
      controlsList='nodownload'
      aria-label={video.alt || `Project video ${index + 1}`}
    >
      Your browser does not support embedded video.
      {source && <a href={source}> Open this video directly.</a>}
    </video>
  );
};

LazyProjectVideo.propTypes = {
  allowAutoplay: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
  video: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    url: PropTypes.string,
    alt: PropTypes.string,
  }).isRequired,
};

const ProjectVideos = ({ videos }) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const saveData = useSaveDataPreference();
  const allowAutoplay = !prefersReducedMotion && !saveData;

  return (
    <div className='w-full grid grid-cols-1 gap-16 md:gap-20 sec-project-x-padding'>
      {videos?.map((video, index) => (
        <LazyProjectVideo
          allowAutoplay={allowAutoplay}
          index={index}
          key={`${video.id || index}:${video.url || ''}`}
          video={video}
        />
      ))}
    </div>
  );
};


ProjectVideos.propTypes = {
  videos: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      url: PropTypes.string,
      alt: PropTypes.string,
    })
  ),
};

export default ProjectVideos;
