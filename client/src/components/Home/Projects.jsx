import React, { useEffect, useRef, useState } from 'react';

import { useAppContext } from '../../App';
import { reqFileWrapper } from '../../axios/requests';
import { Link, useNavigate } from 'react-router-dom';
import useIsGreaterOrEqualMd from '../../hooks/useIsGreaterOrEqualMd';
import { FaArrowRightLong } from 'react-icons/fa6';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import useDocumentHeight from '../../hooks/useDocumentHeight';
import { OutlinedBigIcon } from '../Buttons/OutlinedButton';

function animateImageEntry(img) {
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
      pointerEvents: 'all',
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
    }
  );
}
function animateImageExitForward(img) {
  gsap.to(img, {
    scale: 0.5,
    opacity: 0,
    duration: 1,
    ease: 'power2.inOut',
  });
}

function animateImageExitReverse(img) {
  gsap.to(img, {
    scale: 1.25,
    clipPath: 'polygon(0% 100%,100% 100%,100% 100%,0% 100%)',
    duration: 1,
    ease: 'power2.inOut',
  });

  gsap.to(img.querySelector('img'), {
    filter: 'contrast(2) brightness(10)',
    duration: 1,
    ease: 'power2.inOut',
  });
}

const ProjectsShows = () => {
  const navigate = useNavigate();
  const {
    appData: { projects },
  } = useAppContext();
  const sliderRef = useRef(null);
  const progressBarRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState({});
  const isMidScreen = useIsGreaterOrEqualMd();
  const documentHeight = useDocumentHeight();
  const maxShowed = 5;

  function updateInfoContent(index) {
    const infoItems = document.querySelectorAll('.info > div p');
    const link = document.querySelector('.info .link a');

    infoItems.forEach((item) => (item.innerHTML = ''));

    const item = projects[index];
    const contentArray = [item.title, item.subtitle, item.date];

    infoItems.forEach((element, i) => {
      if (i < 4) {
        const letters = contentArray[i].split('');
        letters.forEach((letter, index) => {
          const span = document.createElement('span');
          span.textContent = letter;
          span.style.opacity = 0;
          element.appendChild(span);

          gsap.to(span, {
            opacity: 1,
            duration: 0.01,
            ease: 'power1.inOut',
            delay: 0.03 * index,
          });
        });
      }
    });
    if (link) {
      // link.setAttribute('href', `/singleProject/${item.value + '@' + item.id}`);
      setActiveSlide(projects[index]);

      const linkText = link.textContent;
      link.innerHTML = '';
      linkText.split('').forEach((letter, index) => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.style.opacity = 0;
        link.appendChild(span);

        gsap.to(span, {
          opacity: 1,
          duration: 0.01,
          ease: 'power1.inOut',
          delay: 0.03 * index,
        });
      });
    }
  }

  useEffect(() => {
    if (projects && projects.length) setActiveSlide(projects[0]);
  }, [projects]);

  useEffect(() => {
    if (!projects.length) return;

    let scrollTriggerInstance;
    let mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', () => {
      const pinnedSection = sliderRef.current;
      const progressBar = progressBarRef.current;
      const slideNum = Math.min(projects.length, maxShowed);
      const pinnedHeight = window.innerHeight * (slideNum * 2);
      const images = gsap.utils.toArray('.img');

      if (images.length && pinnedSection && progressBar) {
        updateInfoContent(0);
        animateImageEntry(images[0]);

        let lastCycle = 0;
        scrollTriggerInstance = ScrollTrigger.create({
          trigger: pinnedSection,
          start: 'top top',
          end: `+=${pinnedHeight} * 2`,
          pin: true,
          pinSpacing: true,
          scrub: 0.1,
          onUpdate: (self) => {
            const totalProgress = self.progress * slideNum;
            const currentCycle = Math.floor(totalProgress);
            const cycleProgress = (totalProgress % 1) * 100;

            if (currentCycle < images.length) {
              const currentImage = images[currentCycle];
              const scale = 1 - (0.25 * cycleProgress) / 100;
              gsap.to(currentImage, {
                scale: scale,
                duration: 0.1,
                overwrite: 'auto',
              });

              if (currentCycle !== lastCycle) {
                if (self.direction > 0) {
                  if (lastCycle < images.length) {
                    animateImageExitForward(images[lastCycle]);
                  }
                  if (currentCycle < images.length) {
                    animateImageEntry(images[currentCycle]);
                    gsap.delayedCall(0.5, () =>
                      updateInfoContent(currentCycle)
                    );
                  }
                } else {
                  if (currentCycle < images.length) {
                    animateImageEntry(images[currentCycle]);
                    gsap.delayedCall(0.5, () =>
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
              gsap.to(progressBar, {
                height: `${cycleProgress}%`,
                duration: 0.1,
                overwrite: true,
              });

              if (cycleProgress < 1 && self.direction > 0) {
                gsap.set(progressBar, { height: '0%' });
              } else if (cycleProgress > 99 && self.direction < 0) {
                gsap.set(progressBar, { height: '100%' });
              }
            } else {
              gsap.to(progressBar, {
                height: self.direction > 0 ? '100%' : `${cycleProgress}%`,
                duration: 0.1,
                overwrite: true,
              });
            }
          },
        });
      }

      return () => {
        if (scrollTriggerInstance) {
          scrollTriggerInstance.kill();
        }
      };
    });

    return () => {
      mm.revert();
    };
  }, [projects, isMidScreen, documentHeight]);

  return (
    <div className='w-full body-max-width sec-inner-x-padding h-auto bg-body-main'>
      <div className='md:min-h-screen w-full'>
        <section
          className='hidden md:block relative min-h-screen w-full'
          ref={sliderRef}
        >
          {/* Info Section */}
          <div className='absolute top-1/2 left-1/2 w-full flex justify-between items-center px-4 pl-0 text-white transform -translate-y-1/2 -translate-x-1/2 text-montreal-mono z-10 mix-blend-difference info '>
            <div className='flex-1 uppercase text-sm pointer-all'>
              <p>{activeSlide?.title || 'TITLE'}</p>
            </div>
            <div
              className='flex-1 uppercase text-sm'
              style={
                {
                  // wordSpacing: '.2rem',
                }
              }
            >
              <p>{activeSlide?.subtitle || 'SUBTITLE'}</p>
            </div>
            <div className='flex-1 text-center uppercase text-sm'>
              <p>{activeSlide?.date || 'DATE'}</p>
            </div>
            {/* <div className='flex-1 uppercase text-sm'>TAG</div> */}
            <div className='flex-1 flex justify-end link'>
              <Link
                to={`/singleProject/${
                  activeSlide.value + '@' + activeSlide.id
                }`}
                key={Date.now()}
                className='relative uppercase text-sm text-white border border-white/25 rounded-md px-2 py-1 hover:bg-white text-pp-eiko hover:text-black transition duration-300 pointer-all'
              >
                Explore
              </Link>
            </div>
          </div>

          {/* Progress Bar */}
          <div className='absolute top-1/2 left-[75%] w-[2px] h-[120px] bg-primary-dark -translate-x-1/2 -translate-y-1/2 progress-bar z-10'>
            <div
              className='absolute top-0 left-0 w-full h-[10%] bg-white z-10 progress'
              ref={progressBarRef}
            ></div>
          </div>

          {/* Images */}
          {projects?.slice(0, maxShowed).map((item, index) => (
            <div
              key={index}
              className='absolute top-1/2 left-1/2 w-[40%] h-[50%] max-h-[350px] transform -translate-x-1/2 -translate-y-1/2 scale-125 -z-[1] overflow-hidden clip-path-polygon-[0%_100%,100%_100%,100%_100%,0%_100%] opacity-0 img'
            >
              <img
                src={
                  item.thumbnailContents && item.thumbnailContents.length
                    ? reqFileWrapper(item.thumbnailContents[0].url)
                    : reqFileWrapper(item?.bannerImg)
                }
                className='w-full h-full object-cover duration-1000 cursor-pointer hover:scale-[103%] filter contrast-100 brightness-100'
                alt={`Image ${index + 1}`}
                onClick={() => {
                  navigate(`/singleProject/${item.value + '@' + item.id}`);
                }}
                loading='lazy'
              />
            </div>
          ))}

          {activeSlide?.id ===
            projects[Math.min(projects.length, maxShowed) - 1]?.id && (
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

        <div className='md:hidden pt-24 mb-20 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 items-start justify-start gap-8'>
          {projects?.slice(0, maxShowed).map((item, key) => {
            return (
              <div
                className='w-full grid border-b-[0.05px] border-opacity-30 border-secondary-light pb-3 gap-4 md:gap-6 group cursor-pointer pointer-all'
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
        <div className='md:hidden flex w-full items-center justify-center my-10'>
          <OutlinedBigIcon
            text={'All works'}
            onClick={() => {
              navigate('/projects');
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectsShows;
