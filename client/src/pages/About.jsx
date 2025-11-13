/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useRef, useState } from 'react';
import HRLine from '../components/utils/HRLine';
import SectionLabel from '../components/utils/SectionLabel';
import {
  OutlinedBigIcon,
  OutlinedSmallButton,
} from '../components/Buttons/OutlinedButton';
import { GravityField, myPic } from '../assets';
import { useAppContext } from '../App';
import {
  achievements,
  education,
  experience,
  workingFields,
} from '../Constants';
import { textBlinkAnimation } from '../animations/textBlinkAnimation';
import useIsGreaterOrEqualMd from '../hooks/useIsGreaterOrEqualMd';
import { wordBlinkAnimation } from '../animations/wordBlinkAnimation';
import PageTransition from '../animations/PageTransition';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLocation } from 'react-router-dom';
import { downloadResume } from '../axios';
import MetaCard from '../components/utils/MetaCard';

const About = () => {
  const [technologies, setTechnologies] = useState([]);
  const { settings } = useAppContext();
  const aboutHeaderRef = useRef(null);

  const aboutPageTextRef = useRef(null);
  const aboutPageParentRef = useRef(null);
  const aboutskillParentRef = useRef(null);
  const aboutskillsRef = useRef(null);
  const isGreaterOrEqualMd = useIsGreaterOrEqualMd();
  const loc = useLocation();

  useEffect(() => {
    let techs = settings?.technologies;

    if (techs) {
      setTechnologies([techs.Languages, techs.Frontend, techs.Backend]);
    }
  }, [settings]);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
    });
  }, [loc.pathname, settings]);

  useEffect(() => {
    if (aboutHeaderRef.current) {
      textBlinkAnimation(aboutHeaderRef.current);
    }
    let st1, st2;

    let timeoutId = setTimeout(() => {
      if (aboutPageParentRef.current && aboutPageTextRef.current) {
        st1 = wordBlinkAnimation(
          aboutPageTextRef.current,
          isGreaterOrEqualMd,
          aboutPageParentRef.current,
          false,
          true,
          null
        );
      }
      if (aboutskillParentRef.current && aboutskillsRef.current) {
        st2 = wordBlinkAnimation(
          aboutskillsRef.current,
          null,
          aboutskillParentRef.current,
          false,
          false,
          null
        );
      }
      // Refresh ScrollTrigger once after animations are set up
      ScrollTrigger.refresh(true);
    }, 400);

    return () => {
      if (st1) {
        st1.kill();
      }
      if (st2) {
        st2.kill();
      }
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='w-full pb-28 flex flex-col gap-20 lg:gap-24 min-h-screen screen-max-width pt-[160px] sec-project-x-padding'>
      <MetaCard title={'About Myself'} />
      <div className='flex flex-col gap-8 w-full md:justify-start '>
        <h1
          ref={aboutHeaderRef}
          className='text-[3rem] md:text-[4rem] uppercase'
        >
          About Myself
        </h1>
        <HRLine disablePadding={true} />
      </div>

      {/* About Description */}
      <div className='w-full'>
        <div className='flex flex-col-reverse md:flex-row gap-16 md:gap-20 justify-between w-full'>
          <div className='w-full h-auto'>
            <SectionLabel text={'TALKS'} noAnime={true} />
            <div
              ref={aboutPageParentRef}
              className='flex mt-8 gap-12 md:gap-[130px] lg:gap-[130px] xl:gap-[140px] flex-col w-full md:min-w-[120px] h-full md:max-w-[350px] lg:max-w-[540px] 3xl:pt-12 3xl:gap-32'
            >
              <p
                ref={aboutPageTextRef}
                className='text-secondary-main md:text-md xl:text-lg uppercase pointer-all'
                style={{
                  wordSpacing: '0.15rem',
                }}
              >
                Passionate programmer with 3+ years of experience in full-stack
                web and mobile app development. I like solving real-world
                problems through code and enjoy collaborating with diverse teams
                to create impactful solutions.
              </p>
              <div className='w-full justify-start flex md:justify-end items-end pr-1'>
                <OutlinedBigIcon
                  text={'DOWNLOAD CV'}
                  onClick={() => downloadResume()}
                />
              </div>
            </div>
          </div>

          <div className='max-w-[400px] m-auto md:m-0 w-full relative'>
            <img
              src={GravityField}
              alt='gravity-field'
              className='w-full h-auto z-0'
              loading='lazy'
            />
            <img
              src={myPic}
              alt='my pic'
              className='w-[70%] md:w-[73%] xl:w-[65%] absolute top-[47%] left-[46%] h-auto z-10 object-cover saturate-[20%] transition-all duration-1000 hover:saturate-[100%] pointer-all'
              style={{ transform: 'translate(-50%,-50%)' }}
              loading='eager'
            />
          </div>
        </div>
      </div>

      {/* <div className='w-full'>
        
        <div className='flex flex-col-reverse md:flex-row gap-20 justify-between w-full'>
          <div className=''>
            <SectionLabel text={'TALKS'} />
            <div className='flex mt-8 gap-12 md:gap-[130px] lg:gap-[140px] flex-col w-full md:min-w-[120px] h-full md:max-w-[350px] lg:max-w-[540px] 3xl:pt-12 3xl:gap-32'>
              <p
                className='text-secondary-main md:text-md xl:text-lg uppercase indent-14'
                style={{
                  wordSpacing: '0.15rem',
                }}
              >
                Passionate programmer with 3+ years of experience in full-stack
                web and mobile app development. I like solving real-world
                problems through code and enjoy collaborating with diverse teams
                to create impactful solutions.
              </p>
              <div className='w-full justify-start flex md:justify-end items-end pr-1'>
                <OutlinedBigIcon text={'DOWNLOAD CV'} />
              </div>
            </div>
          </div>

          
          <div className='relative flex justify-center w-fit items-center overflow-visible'>
            <div className='relative max-w-[280px] w-full'>
              <img
                src={myPic}
                alt='profile-pic'
                className='w-full h-auto z-10 object-cover saturate-[20%]'
              />
            </div>
            <img
              src={GravityField}
              alt='gravity-field'
              className='absolute w-[80%] md:w-[450px] h-auto top-0 left-1/2 transform -translate-x-1/2 z-40'
              loading='lazy'
            />
          </div>
        </div>
      </div> */}

      {/* skill sec */}
      <div ref={aboutskillParentRef} className='w-full flex flex-col gap-6'>
        <div className='flex flex-col gap-4 w-fit'>
          <h1 className='text-lg md:text-3xl inline animte-help-text-reveal'>
            I can help you with...
          </h1>
          <HRLine disablePadding={true} />
        </div>

        <div
          ref={aboutskillsRef}
          className='w-full leading-9 text-pp-eiko text-2xl uppercase'
        >
          {workingFields}
        </div>

        <div className='grid gap-6 mt-4'>
          <div className=''>
            <SectionLabel text='Technologies' noAnime={true} />
          </div>
          <div className='w-full flex flex-col items-start justify-start gap-7'>
            {technologies?.map((item, key) => {
              return (
                <div key={key} className='flex flex-row flex-wrap gap-3'>
                  {item?.map((prop, i) => (
                    <OutlinedSmallButton
                      disableHover={true}
                      key={i}
                      text={prop}
                      classes={`uppercase`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* experiences */}
      <div className='w-full grid gap-6'>
        <SectionLabel text={'EXPERIENCES'} noAnime={true} />
        <HRLine disablePadding={true} />
        {experience.map((item, key) => (
          <React.Fragment key={key}>
            <div
              className='w-full grid gap-3 group cursor-pointer pointer-all'
              onClick={() => window.open(item.link, '_blank')}
            >
              <div className='flex items-start gap-4 justify-between'>
                <span className='text-secondary-light text-sm text-montreal-mono cursor-pointer pointer-all group-hover:underline'>
                  {item.company}
                </span>
                <span className='text-xs text-onPrimary-dark'>{item.date}</span>
              </div>

              <h2 className='text-primary-main text-pp-eiko text-2xl'>
                {item.designation}
              </h2>
            </div>
            <HRLine disablePadding={true} />
          </React.Fragment>
        ))}
      </div>

      {/* achievements */}
      <div className='w-full grid gap-6'>
        <SectionLabel text={'ACHIEVEMENTS'} noAnime={true} />
        <HRLine disablePadding={true} />
        {achievements.map((item, key) => (
          <React.Fragment key={key}>
            <div
              className='w-full grid gap-3 group cursor-pointer pointer-all'
              onClick={() => window.open(item.link, '_blank')}
            >
              <div className='flex items-start gap-4 justify-between'>
                <span className='text-secondary-light text-sm text-montreal-mono cursor-pointer pointer-all group-hover:underline'>
                  {item.from}
                </span>
                <span className='text-xs text-onPrimary-dark'>{item.date}</span>
              </div>

              <h2 className='text-primary-main text-pp-eiko text-2xl'>
                {item.title}
              </h2>
            </div>
            <HRLine disablePadding={true} />
          </React.Fragment>
        ))}
      </div>

      {/* education */}
      <div className='w-full grid gap-6'>
        <SectionLabel text={'EDUCATION'} noAnime={true} />
        <HRLine disablePadding={true} />
        {education.map((item, key) => (
          <React.Fragment key={key}>
            <div className='w-full grid gap-3'>
              <div className='flex items-start gap-4 justify-between'>
                <span className='text-secondary-light text-sm text-montreal-mono'>
                  {item.degree}
                </span>
                <span className='text-xs text-onPrimary-dark'>{item.date}</span>
              </div>

              <h2 className='text-primary-main text-pp-eiko text-2xl'>
                {item.institute}
              </h2>
            </div>
            <HRLine disablePadding={true} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default PageTransition(About);
