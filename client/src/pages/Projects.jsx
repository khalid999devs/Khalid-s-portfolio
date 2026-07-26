/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from 'react';
import { OutlinedBigIcon } from '../components/Buttons/OutlinedButton';
import { useAppContext } from '../App';
import { reqFileWrapper } from '../axios/requests';
import { FaArrowRightLong } from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import PageTransition from '../animations/PageTransition';
import MetaCard from '../components/utils/MetaCard';
import LoadingSpinner from '../components/utils/LoadingSpinner';
import { handleImageFallback } from '../utils/imageFallback';

const Projects = () => {
  const {
    appData: { projects },
    loading,
  } = useAppContext();
  const [targetCat, setTargetCat] = useState('all');
  const categories = useMemo(
    () => [
      'all',
      ...new Set(
        (projects || []).map((item) => item.category).filter(Boolean)
      ),
    ],
    [projects]
  );
  const activeCategory = categories.includes(targetCat) ? targetCat : 'all';
  const visibleProjects = useMemo(
    () =>
      (projects || []).filter(
        (item) =>
          activeCategory === 'all' || item.category === activeCategory
      ),
    [activeCategory, projects]
  );

  return (
    <div className='w-full pb-28 min-h-screen screen-max-width pt-[160px] sec-x-padding'>
      <MetaCard title={'Projects'} />

      <div className='flex flex-col gap-8 w-full md:pl-28'>
        <div className='flex w-full justify-center md:justify-start items-center gap-4'>
          <h1 className='flex items-center gap-4 text-[2.2rem] sm:text-[3rem] md:text-[4rem] text-letter-reveal'>
            <span className='text-pp-eiko'>SELECTED</span>
            <span>WORKS</span>
          </h1>
        </div>

        {projects?.length ? (
          <div className='flex flex-row flex-wrap gap-3 items-center justify-center md:justify-start'>
            {categories.map((item) => (
              <OutlinedBigIcon
                classes={`border-[0.2px]! border-onPrimary-main/50! rounded-[3px]! capitalize ${
                  item === activeCategory ? 'bg-white! text-black!' : ''
                }`}
                text={item}
                key={item}
                pressed={item === activeCategory}
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

      {loading && !projects?.length ? (
        <LoadingSpinner
          className='min-h-[320px]'
          label='Loading projects'
          sizeClass='h-14 w-14'
        />
      ) : visibleProjects.length ? (
        <div className='mt-32 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 items-start justify-start gap-8'>
          {visibleProjects.map((item, key) => {
              const thumbnail = item.thumbnailContents?.[0];

              return (
                <Link
                  to={`/singleProject/${item.value + '@' + item.id}`}
                  className='w-full grid border-b-[0.05px] border-secondary-light/30 pb-3 gap-6 group cursor-pointer pointer-all'
                  key={item.id || key}
                >
                  <div className='w-full h-full rounded-lg overflow-hidden '>
                    <img
                      src={
                        thumbnail
                          ? reqFileWrapper(thumbnail.url)
                          : reqFileWrapper(item?.bannerImg)
                      }
                      width={thumbnail?.width}
                      height={thumbnail?.height}
                      alt={item.title}
                      onError={handleImageFallback}
                      className='w-full max-h-[300px] lg:max-h-[350px] 2xl:max-h-[300px] h-auto object-cover rounded-lg transition-all duration-1000 group-hover:scale-[102%]'
                      loading='lazy'
                      decoding='async'
                    />
                  </div>

                  <div className='w-full'>
                    <div className='w-full flex justify-between items-center flex-row flex-wrap gap-5'>
                      <span className='text-[10px] sm:text-xs text-muted-light opacity-80 uppercase'>
                        PROJECT /{key + 1 < 10 ? `0${key + 1}` : key + 1}
                      </span>
                      <span className='text-[10px] sm:text-xs text-muted-light opacity-80 uppercase'>
                        {item.role.join(' — ')}
                      </span>
                    </div>

                    <div className='w-full flex justify-between items-center flex-wrap gap-4 mt-3'>
                      <h2 className='text-white text-base sm:text-xl md:text-2xl line-clamp-1 max-w-[85%]'>
                        {item.title}
                      </h2>

                      <FaArrowRightLong
                        aria-hidden='true'
                        className='text-white text-2xl transition-all duration-500 group-hover:-translate-x-1'
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      ) : (
        <p
          className='mt-32 text-center text-muted-light'
          role='status'
        >
          No projects are available in this category yet.
        </p>
      )}
    </div>
  );
};

export default PageTransition(Projects);
