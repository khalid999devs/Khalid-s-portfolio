import React, { useEffect, useRef } from 'react';
import SectionLabel from '../utils/SectionLabel';
import { GravityField, myPic } from '../../assets';
import { OutlinedBigIcon } from '../Buttons/OutlinedButton';
import SkillsAndTechs from './SkillsAndTechs';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';
import useIsGreaterOrEqualMd from '../../hooks/useIsGreaterOrEqualMd';
import { downloadResume } from '../../axios';

const About = () => {
  const aboutTextRef = useRef(null);
  const aboutParentRef = useRef(null);
  const isGreaterOrEqualMd = useIsGreaterOrEqualMd();

  useEffect(() => {
    if (aboutParentRef.current && aboutTextRef.current) {
      wordBlinkAnimation(
        aboutTextRef.current,
        isGreaterOrEqualMd,
        aboutParentRef.current,
        false,
        true
      );
    }
  }, []);

  return (
    <div
      ref={aboutParentRef}
      className='pt-16 min-h-[300px] w-full pb-16 body-max-width sec-inner-x-padding'
    >
      {/* about me */}
      <div className='w-full flex mb-20 md:mb-12 xl:mb-6 items-start justify-between flex-col lg:flex-row gap-6 md:gap-10 lg:gap-36 '>
        <div className='pt-6 xl:pt-14'>
          <SectionLabel text='About' />
        </div>

        {/* Image and text */}
        <div className='flex flex-col justify-center items-center md:items-start md:flex-row md:justify-between w-full lg:w-[72%]'>
          <div className='max-w-[400px] w-full relative'>
            <img
              src={GravityField}
              alt='gravity-field'
              className='w-full h-auto z-0'
              loading='lazy'
            />
            <img
              src={myPic}
              alt='gravity-field'
              className='w-[72%] md:w-[70%] lg:w-[75%] xl:w-[65%] absolute top-[47%] left-[46%] h-auto z-10 object-cover saturate-[20%] transition-all duration-1000 hover:saturate-[100%] pointer-all'
              style={{ transform: 'translate(-50%,-50%)' }}
              loading='lazy'
            />
          </div>

          <div className='flex gap-10 md:gap-20 mds:gap-[115px] mdl:gap-[190px] lg:gap-[85px] xl:gap-[104px] md:pt-10 lg:pt-[25px] xl:pt-[60px] md:pl-16 flex-col w-full md:min-w-[120px] justify-between h-full md:max-w-[400px] lg:max-w-[500px] 3xl:pt-16 3xl:gap-36 mt-4 md:mt-0'>
            <p
              ref={aboutTextRef}
              className='text-secondary-main md:text-sm xl:text-base uppercase pointer-all'
              style={{
                wordSpacing: '0.15rem',
              }}
            >
              Passionate programmer with 3+ years of experience in full-stack
              web and mobile app development. I like solving real-world problems
              through code and enjoy collaborating with diverse teams to create
              impactful solutions.
            </p>
            <div className='inline-block m-auto md:m-0'>
              <OutlinedBigIcon
                text={'DOWNLOAD CV'}
                onClick={() => downloadResume()}
              />
            </div>
          </div>
        </div>
      </div>

      {/* skills and techs */}
      <SkillsAndTechs />
    </div>
  );
};

export default About;
