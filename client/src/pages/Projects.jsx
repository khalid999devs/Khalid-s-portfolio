import React, { useEffect, useState } from 'react';
import { OutlinedBigIcon } from '../components/Buttons/OutlinedButton';
import { useAppContext } from '../App';
import { reqFileWrapper } from '../axios/requests';
import { FaArrowRightLong } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';

const Projects = () => {
  const navigate = useNavigate();
  const {
    appData: { projects },
  } = useAppContext();
  const [categories, setCategories] = useState([]);
  const [targetCat, setTargetCat] = useState('all');

  useEffect(() => {
    if (projects?.length > 0)
      setCategories(['all', ...new Set(projects.map((item) => item.category))]);
  }, [projects]);

  return (
    <div className='w-full pb-28 min-h-screen screen-max-width pt-[160px] sec-x-padding'>
      <div className='flex flex-col gap-8 pl-8 md:pl-28'>
        <div className='flex w-full justify-center md:justify-start items-center gap-4'>
          <h1 className='text-[3rem] md:text-[4rem] text-pp-eiko'>SELECTED</h1>

          <h1 className='text-[3rem] md:text-[4rem]'>WORKS</h1>
        </div>

        <div className='flex flex-row gap-3 items-center justify-center md:justify-start'>
          {categories?.map((item, key) => (
            <OutlinedBigIcon
              classes={`!border-[0.2px] border-opacity-50 !rounded-[3px] capitalize ${
                item === targetCat ? '!bg-white !text-black' : ''
              }`}
              text={item}
              key={key}
              onClick={() => {
                setTargetCat(item);
              }}
            />
          ))}
        </div>
      </div>

      <div className='mt-32 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 items-start justify-start gap-8'>
        {projects?.map((item, key) => {
          return (
            <div
              className='w-full grid border-b-[0.05px] border-opacity-30 border-secondary-light pb-3 gap-6 group cursor-pointer'
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
                <div className='w-full flex justify-between items-center flex-row flex-wrap gap-5'>
                  <span className='text-[10px] sm:text-xs text-secondary-light opacity-80 uppercase'>
                    PROJECT /{key + 1 < 10 ? `0${key + 1}` : key + 1}
                  </span>
                  <span className='text-[10px] sm:text-xs text-secondary-light opacity-80 uppercase'>
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
    </div>
  );
};

export default Projects;
