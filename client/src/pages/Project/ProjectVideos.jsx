import React, { useState, useRef, useEffect } from 'react';
import { reqFileWrapper } from '../../axios/requests';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// gsap.registerPlugin(ScrollTrigger);

const ProjectVideos = ({ videos }) => {
  const videoRefs = useRef([]);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  useEffect(() => {
    const triggers = videoRefs.current.map((video) => {
      if (!video) return null;

      return gsap.to(video, {
        scrollTrigger: {
          trigger: video,
          start: '-10% bottom',
          // toggleActions: 'play pause play pause',
          onEnter: () => {
            video.play();
          },
          onLeave: () => {
            video.pause();
          },
          onEnterBack: () => {
            video.play();
          },
          onLeaveBack: () => {
            video.pause();
          },
        },
      });
    });

    return () => {
      triggers.forEach((trigger) => trigger?.scrollTrigger?.kill());
    };
  }, [videos]);

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
          controls={hoveredIndex === key}
          controlsList='nodownload'
          onMouseEnter={() => setHoveredIndex(key)}
          onMouseLeave={() => setHoveredIndex(null)}
        ></video>
      ))}
    </div>
  );
};

export default ProjectVideos;
