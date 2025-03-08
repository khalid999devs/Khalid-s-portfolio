import React, { useState } from 'react';
import { reqFileWrapper } from '../../axios/requests';

const ProjectVideos = ({ videos }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <div className='w-full grid grid-cols-1 gap-16 md:gap-20 sec-project-x-padding'>
      {videos?.map((video, key) => (
        <video
          key={key}
          src={reqFileWrapper(video.url)}
          className='w-full max-h-[500px] object-cover h-auto transition-transform duration-500 ease-out transform pointer-all'
          autoPlay
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
