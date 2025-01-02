import React, { useEffect, useState } from 'react';
import { OutlinedBigIcon } from '../components/Buttons/OutlinedButton';
import { useAppContext } from '../App';

const Projects = () => {
  const {
    appData: { projects },
  } = useAppContext();
  const [categories, setCategories] = useState([]);
  const [targetCat, setTargetCat] = useState('all');

  useEffect(() => {
    if (projects?.length > 0)
      setCategories(['all', ...new Set(projects.map((item) => item.category))]);
  }, [projects]);

  console.log(categories);

  return (
    <div className='w-full pb-16 min-h-screen screen-max-width pt-[160px]'>
      <div className='flex flex-col gap-8 pl-12 md:pl-28'>
        <div className='flex items-center gap-4'>
          <h1 className='text-[2.5rem] md:text-[3.5rem] text-pp-eiko'>
            SELECTED
          </h1>

          <h1 className='text-[2.5rem] md:text-[3.5rem]'>WORKS</h1>
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

      <div className='mt-32 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 items-start justify-start gap-8'>
        {projects?.map((item, key) => {
          return <div className='w-full bg-red-400'>{item.title}</div>;
        })}
      </div>
    </div>
  );
};

export default Projects;
