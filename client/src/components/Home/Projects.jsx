import { useEffect, useRef, useState, useCallback } from 'react';
import { handleImageFallback } from '../../utils/imageFallback';

import { useAppContext } from '../../App';
import { reqFileWrapper } from '../../axios/requests';
import { Link, useNavigate } from 'react-router-dom';
import useIsGreaterOrEqualMd from '../../hooks/useIsGreaterOrEqualMd';
import { FaArrowRightLong } from 'react-icons/fa6';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { OutlinedBigIcon } from '../Buttons/OutlinedButton';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import LoadingSpinner from '../utils/LoadingSpinner';

const MAX_PROJECTS_SHOWN = 5;
const VIEWPORTS_PER_SLIDE = 2;

const setSlideInteraction = (slide, isActive) => {
  slide.inert = !isActive;
  slide.style.pointerEvents = isActive ? 'auto' : 'none';

  if (isActive) {
    slide.removeAttribute('aria-hidden');
  } else {
    slide.setAttribute('aria-hidden', 'true');
  }

  const link = slide.querySelector('a');
  if (link) link.tabIndex = isActive ? 0 : -1;
};

function animateImageEntry(img) {
  setSlideInteraction(img, true);

  gsap.fromTo(
    img,
    {
      scale: 1.25,
      clipPath: 'polygon(0% 100%,100% 100%,100% 100%,0% 100%)',
      opacity: 0,
    },
    {
      scale: 1,
      clipPath: 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)',
      opacity: 1,
      duration: 1,
      ease: 'power2.inOut',
      overwrite: 'auto',
    }
  );

  gsap.fromTo(
    img.querySelector('img'),
    {
      filter: 'contrast(2) brightness(10)',
    },
    {
      filter: 'contrast(1) brightness(1)',
      duration: 1,
      ease: 'power2.inOut',
      overwrite: 'auto',
    }
  );
}
function animateImageExitForward(img) {
  setSlideInteraction(img, false);

  gsap.to(img, {
    scale: 0.5,
    opacity: 0,
    duration: 1,
    ease: 'power2.inOut',
    overwrite: 'auto',
  });
}

function animateImageExitReverse(img) {
  setSlideInteraction(img, false);

  gsap.to(img, {
    scale: 1.25,
    clipPath: 'polygon(0% 100%,100% 100%,100% 100%,0% 100%)',
    duration: 1,
    ease: 'power2.inOut',
    overwrite: 'auto',
  });

  gsap.to(img.querySelector('img'), {
    filter: 'contrast(2) brightness(10)',
    duration: 1,
    ease: 'power2.inOut',
    overwrite: 'auto',
  });
}

const ProjectsShows = () => {
  const navigate = useNavigate();
  const {
    appData: { projects },
    loading,
  } = useAppContext();
  const sliderRef = useRef(null);
  const progressBarRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState({});
  const isMidScreen = useIsGreaterOrEqualMd();
  const prefersReducedMotion = usePrefersReducedMotion();

  const updateInfoContent = useCallback(
    (index) => {
      const item = projects[index];
      if (item) setActiveSlide(item);
    },
    [projects]
  );

  useEffect(() => {
    if (projects && projects.length) setActiveSlide(projects[0]);
  }, [projects]);

  useEffect(() => {
    if (projects?.length < 2 || !isMidScreen || prefersReducedMotion) {
      return undefined;
    }

    let infoUpdateCall;
    const pinnedSection = sliderRef.current;
    const progressBar = progressBarRef.current;
    if (!pinnedSection || !progressBar) return undefined;

    const images = gsap.utils.toArray(
      '[data-project-slide]',
      pinnedSection
    );
    const slideNum = images.length;
    if (!slideNum) return undefined;

    const imageScaleSetters = images.map((image) =>
      gsap.quickSetter(image, 'scale')
    );
    const setProgressHeight = gsap.quickSetter(progressBar, 'height');
    updateInfoContent(0);
    animateImageEntry(images[0]);

    let lastCycle = 0;
    const scrollTriggerInstance = ScrollTrigger.create({
      trigger: pinnedSection,
      start: 'top top',
      end: () =>
        `+=${window.innerHeight * slideNum * VIEWPORTS_PER_SLIDE}`,
      invalidateOnRefresh: true,
      pin: true,
      pinSpacing: true,
      scrub: 0.1,
      onUpdate: (self) => {
        const totalProgress = self.progress * slideNum;
        const currentCycle = Math.floor(totalProgress);
        const cycleProgress = (totalProgress % 1) * 100;

        if (currentCycle < images.length) {
          const scale = 1 - (0.25 * cycleProgress) / 100;
          imageScaleSetters[currentCycle](scale);

          if (currentCycle !== lastCycle) {
            if (self.direction > 0) {
              if (lastCycle < images.length) {
                animateImageExitForward(images[lastCycle]);
              }
              if (currentCycle < images.length) {
                animateImageEntry(images[currentCycle]);
                infoUpdateCall?.kill();
                infoUpdateCall = gsap.delayedCall(0.5, () =>
                  updateInfoContent(currentCycle)
                );
              }
            } else {
              if (currentCycle < images.length) {
                animateImageEntry(images[currentCycle]);
                infoUpdateCall?.kill();
                infoUpdateCall = gsap.delayedCall(0.5, () =>
                  updateInfoContent(currentCycle)
                );
              }
              if (lastCycle < images.length) {
                animateImageExitReverse(images[lastCycle]);
              }
            }
            lastCycle = currentCycle;
          }
        }

        if (currentCycle < slideNum) {
          setProgressHeight(`${cycleProgress}%`);

          if (cycleProgress < 1 && self.direction > 0) {
            setProgressHeight('0%');
          } else if (cycleProgress > 99 && self.direction < 0) {
            setProgressHeight('100%');
          }
        } else {
          setProgressHeight(
            self.direction > 0 ? '100%' : `${cycleProgress}%`
          );
        }
      },
    });

    return () => {
      infoUpdateCall?.kill();
      scrollTriggerInstance.kill();
      gsap.killTweensOf(images);
      images.forEach((image) =>
        gsap.killTweensOf(image.querySelector('img'))
      );
      gsap.killTweensOf(progressBar);
    };
  }, [
    projects,
    isMidScreen,
    prefersReducedMotion,
    updateInfoContent,
  ]);

  return (
    <div className='w-full body-max-width sec-inner-x-padding h-auto bg-body-main'>
      <div className='md:min-h-screen w-full'>
        {loading && !projects?.length ? (
          <LoadingSpinner
            className='min-h-[50vh]'
            label='Loading featured projects'
            sizeClass='h-14 w-14'
          />
        ) : !projects?.length ? (
          <p
            className='flex min-h-[40vh] items-center justify-center text-center text-muted-light'
            role='status'
          >
            Featured projects are being prepared.
          </p>
        ) : isMidScreen &&
        !prefersReducedMotion &&
        projects?.length > 1 ? (
          <section
            aria-label='Featured projects'
            className='relative min-h-screen w-full'
            ref={sliderRef}
          >
          {/* Info Section */}
          <div className='absolute top-1/2 left-1/2 w-full flex justify-between items-center px-4 pl-0 text-white transform -translate-y-1/2 -translate-x-1/2 text-montreal-mono z-10 mix-blend-difference info '>
            <div className='flex-1 uppercase text-sm pointer-all'>
              <p className='md:w-[75%]'>{activeSlide?.title || 'TITLE'}</p>
            </div>
            <div className='flex-1 uppercase text-sm'>
              <p>{activeSlide?.subtitle || 'SUBTITLE'}</p>
            </div>
            <div className='flex-1 text-center uppercase text-sm'>
              <p>{activeSlide?.date || 'DATE'}</p>
            </div>
            <div className='flex-1 flex justify-end link'>
              {activeSlide?.id && activeSlide?.value && (
                <Link
                  to={`/singleProject/${
                    activeSlide.value + '@' + activeSlide.id
                  }`}
                  key={activeSlide.id}
                  className='relative uppercase text-sm text-white border border-white/25 rounded-md px-2 py-1 hover:bg-white text-pp-eiko hover:text-black transition duration-300 pointer-all'
                >
                  Explore
                </Link>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div
            aria-hidden='true'
            className='absolute top-1/2 left-[75%] w-[2px] h-[120px] bg-primary-dark -translate-x-1/2 -translate-y-1/2 progress-bar z-10'
          >
            <div
              className='absolute top-0 left-0 w-full h-[10%] bg-white z-10 progress'
              ref={progressBarRef}
            ></div>
          </div>

          {/* Images */}
          {projects?.slice(0, MAX_PROJECTS_SHOWN).map((item, index) => {
            const thumbnail = item.thumbnailContents?.[0];

            return (
              <div
                aria-hidden={index === 0 ? undefined : 'true'}
                data-project-slide
                inert={index !== 0}
                key={item.id || index}
                style={{
                  pointerEvents: index === 0 ? 'auto' : 'none',
                }}
                className='absolute top-1/2 left-1/2 w-[40%] h-[50%] max-h-[350px] transform -translate-x-1/2 -translate-y-1/2 scale-125 -z-[1] overflow-hidden [clip-path:polygon(0%_100%,100%_100%,100%_100%,0%_100%)] opacity-0 img'
              >
                <Link
                  to={`/singleProject/${item.value + '@' + item.id}`}
                  aria-label={`View ${item.title}`}
                  className='block w-full h-full'
                  tabIndex={index === 0 ? 0 : -1}
                >
                  <img
                    src={
                      thumbnail
                        ? reqFileWrapper(thumbnail.url)
                        : reqFileWrapper(item?.bannerImg)
                    }
                    width={thumbnail?.width}
                    height={thumbnail?.height}
                    className='w-full h-full object-cover duration-1000 cursor-pointer hover:scale-[103%] filter contrast-100 brightness-100'
                    alt={`${item.title} project thumbnail`}
                    onError={handleImageFallback}
                    loading='lazy'
                    decoding='async'
                  />
                </Link>
              </div>
            );
          })}

          {activeSlide?.id ===
            projects[
              Math.min(projects.length, MAX_PROJECTS_SHOWN) - 1
            ]?.id && (
            <div className='absolute left-1/2 bottom-3 -translate-x-1/2'>
              <OutlinedBigIcon
                text={'All works'}
                onClick={() => {
                  navigate('/projects');
                }}
              />
            </div>
            )}
          </section>
        ) : (
          <>
        <div className='pt-24 mb-20 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 items-start justify-start gap-8'>
          {projects?.slice(0, MAX_PROJECTS_SHOWN).map((item, key) => {
            const thumbnail = item.thumbnailContents?.[0];

            return (
              <Link
                to={`/singleProject/${item.value + '@' + item.id}`}
                className='w-full grid border-b-[0.05px] border-secondary-light/30 pb-3 gap-4 md:gap-6 group cursor-pointer pointer-all'
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
                  <div className='w-full flex justify-between items-center flex-row flex-wrap gap-1 md:gap-5'>
                    <span className='text-[10px] text-muted-light opacity-80 uppercase'>
                      PROJECT /{key + 1 < 10 ? `0${key + 1}` : key + 1}
                    </span>
                    <span className='text-[10px] text-muted-light opacity-80 uppercase'>
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
        <div className='flex w-full items-center justify-center my-10'>
          <OutlinedBigIcon
            text={'All works'}
            onClick={() => {
              navigate('/projects');
            }}
          />
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectsShows;
