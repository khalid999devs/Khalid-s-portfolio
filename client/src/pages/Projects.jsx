/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { OutlinedBigIcon } from '../components/Buttons/OutlinedButton';
import { useAppContext } from '../App';
import { reqFileWrapper } from '../axios/requests';
import { FaArrowRightLong } from 'react-icons/fa6';
import { useLocation, useNavigate } from 'react-router-dom';
import PageTransition from '../animations/PageTransition';
import MetaCard from '../components/utils/MetaCard';

const Projects = () => {
  const loc = useLocation();
  const navigate = useNavigate();
  const {
    appData: { projects },
  } = useAppContext();
  const [categories, setCategories] = useState([]);
  const [targetCat, setTargetCat] = useState('all');

  useEffect(() => {
    window.scrollTo({
      left: 0,
      top: 0,
    });
  }, [projects, loc.pathname]);

  useEffect(() => {
    if (projects?.length > 0)
      setCategories(['all', ...new Set(projects.map((item) => item.category))]);
  }, [projects]);

  return (
    <div className='w-full pb-28 min-h-screen screen-max-width pt-[160px] sec-x-padding'>
      <MetaCard title={'Projects'} />

      <div className='flex flex-col gap-8 w-full md:pl-28'>
        <div className='flex w-full justify-center md:justify-start items-center gap-4'>
          <h1 className='text-[2.2rem] sm:text-[3rem] md:text-[4rem] text-pp-eiko text-letter-reveal'>
            SELECTED
          </h1>

          <h1 className='text-[2.2rem] sm:text-[3rem] md:text-[4rem] text-letter-reveal'>
            WORKS
          </h1>
        </div>

        {categories?.length ? (
          <div className='flex flex-row flex-wrap gap-3 items-center justify-center md:justify-start'>
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
        ) : (
          <></>
        )}
      </div>

      {projects?.length ? (
        <div className='mt-32 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 items-start justify-start gap-8'>
          {projects
            ?.filter((item) => {
              if (targetCat === 'all') return true;
              return item.category === targetCat;
            })
            .map((item, key) => {
              return (
                <div
                  className='w-full grid border-b-[0.05px] border-opacity-30 border-secondary-light pb-3 gap-6 group cursor-pointer pointer-all'
                  onClick={() => {
                    navigate(`/singleProject/${item.value + '@' + item.id}`);
                  }}
                  key={key}
                >
                  <div className='w-full h-full rounded-lg overflow-hidden '>
                    <img
                      src={
                        item.thumbnailContents && item.thumbnailContents.length
                          ? reqFileWrapper(item.thumbnailContents[0].url)
                          : reqFileWrapper(item?.bannerImg)
                      }
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
                      <h2 className='text-white text-base sm:text-xl md:text-2xl line-clamp-1 max-w-[85%]'>
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
      ) : (
        <></>
      )}
    </div>
  );
};

export default PageTransition(Projects);
