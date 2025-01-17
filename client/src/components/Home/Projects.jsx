import React, { useEffect, useRef, useState } from 'react';

import { useAppContext } from '../../App';
import { reqFileWrapper } from '../../axios/requests';
import { useNavigate } from 'react-router-dom';
import useIsGreaterOrEqualMd from '../../hooks/useIsGreaterOrEqualMd';
import { FaArrowRightLong } from 'react-icons/fa6';

const ProjectsShows = () => {
  const navigate = useNavigate();
  const {
    appData: { projects },
  } = useAppContext();
  const sliderRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState({});
  const isMidScreen = useIsGreaterOrEqualMd();

  useEffect(() => {
    setActiveSlide(projects[0]);
  }, [projects]);

  return (
    <div className='w-full body-max-width sec-inner-x-padding h-auto'>
      <div className='md:min-h-screen w-full'>
        {isMidScreen ? (
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
        ) : (
          <div className='mt-24 mb-20 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 items-start justify-start gap-8'>
            {projects?.map((item, key) => {
              return (
                <div
                  className='w-full grid border-b-[0.05px] border-opacity-30 border-secondary-light pb-3 gap-4 md:gap-6 group cursor-pointer'
                  onClick={() => {
                    navigate(`/singleProject/${item.value + '@' + item.id}`);
                  }}
                  key={key}
                >
                  <div className='w-full h-full rounded-lg overflow-hidden '>
                    <img
                      src={reqFileWrapper(item.bannerImg)}
                      alt={item.title}
                      className='w-full max-h-[300px] lg:max-h-[350px] 2xl:max-h-[300px] h-auto object-cover rounded-lg transition-all duration-1000 group-hover:scale-[102%]'
                      loading='lazy'
                    />
                  </div>

                  <div className='w-full'>
                    <div className='w-full flex justify-between items-center flex-row flex-wrap gap-1 md:gap-5'>
                      <span className='text-[10px] text-secondary-light opacity-80 uppercase'>
                        PROJECT /{key + 1 < 10 ? `0${key + 1}` : key + 1}
                      </span>
                      <span className='text-[10px] text-secondary-light opacity-80 uppercase'>
                        {item.role.join(' — ')}
                      </span>
                    </div>

                    <div className='w-full flex justify-between items-center flex-wrap gap-4 mt-3'>
                      <h2 className='text-white text-base sm:text-xl md:text-2xl'>
                        {item.title}
                      </h2>

                      <button className=''>
                        <FaArrowRightLong className='text-white text-2xl transition-all duration-500 group-hover:-translate-x-1' />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsShows;
