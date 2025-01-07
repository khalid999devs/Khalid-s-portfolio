import React, { useEffect, useRef, useState } from 'react';

import { useAppContext } from '../../App';
import { reqFileWrapper } from '../../axios/requests';
import { useNavigate } from 'react-router-dom';

const ProjectsShows = () => {
  const navigate = useNavigate();
  const {
    appData: { projects },
  } = useAppContext();
  const sliderRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState({});

  useEffect(() => {
    setActiveSlide(projects[0]);
  }, [projects]);

  return (
    <div className='w-full body-max-width sec-inner-x-padding h-auto'>
      <div className='min-h-screen w-full'>
        <section className='relative min-h-screen w-full'>
          {/* Info Section */}
          <div className='absolute top-1/2 left-1/2 w-full flex justify-between items-center px-4 pl-0 text-white transform -translate-y-1/2 -translate-x-1/2 text-montreal-mono z-10 mix-blend-difference'>
            <div className='flex-1 uppercase text-sm'>
              {activeSlide?.title || 'TITLE'}
            </div>
            <div
              className='flex-1 uppercase text-sm'
              style={
                {
                  // wordSpacing: '.2rem',
                }
              }
            >
              {activeSlide?.subtitle || 'SUBTITLE'}
            </div>
            <div className='flex-1 text-center uppercase text-sm'>
              {activeSlide?.date || 'DATE'}
            </div>
            {/* <div className='flex-1 uppercase text-sm'>TAG</div> */}
            <div className='flex-1 flex justify-end'>
              <a
                href='#'
                className='uppercase text-sm text-white border border-white/25 rounded-md px-2 py-1 hover:bg-white text-pp-eiko hover:text-black transition duration-300'
              >
                Explore
              </a>
            </div>
          </div>

          {/* Progress Bar */}
          <div className='absolute top-1/2 left-[75%] w-[2px] h-[120px] bg-primary-dark -translate-x-1/2 -translate-y-1/2'>
            <div className='absolute top-0 left-0 w-full h-[10%] bg-white z-10'></div>
          </div>

          {/* Images */}
          {projects.map((item, index) => (
            <div
              key={index}
              className='absolute top-1/2 left-1/2 w-[35%] h-[50%] transform -translate-x-1/2 -translate-y-1/2 scale-125 z-[1] overflow-hidden clip-path-polygon-[0%_100%,100%_100%,100%_100%,0%_100%]'
            >
              <img
                src={reqFileWrapper(item?.bannerImg)}
                className='w-full h-full object-cover duration-1000 cursor-pointer hover:scale-110 filter contrast-100 brightness-100'
                alt={`Image ${index + 1}`}
                onClick={() => {
                  navigate(`/singleProject/${item.value + '@' + item.id}`);
                }}
              />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default ProjectsShows;
