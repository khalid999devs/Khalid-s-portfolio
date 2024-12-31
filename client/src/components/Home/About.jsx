import React from 'react';
import SectionLabel from '../utils/SectionLabel';
import { GravityField, myPic } from '../../assets';
import { OutlinedBigIcon } from '../Buttons/OutlinedButton';
import SkillsAndTechs from './SkillsAndTechs';

const About = () => {
  return (
    <div className='pt-16 min-h-[300px] w-full pb-16 body-max-width sec-inner-x-padding'>
      {/* about me */}
      <div className='w-full flex items-start justify-between flex-col md:flex-row gap-10 md:gap-28 lg:gap-36 '>
        <div className='pt-14'>
          <SectionLabel text='About' />
        </div>

        {/* Image and text */}
        <div className='flex justify-between w-full md:w-[72%]'>
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
              className='md:w-[73%] xl:w-[65%] absolute top-[47%] left-[46%] h-auto z-10 object-cover saturate-[20%]'
              style={{ transform: 'translate(-50%,-50%)' }}
            />
          </div>

          <div className='flex gap-[104px] pt-[60px] pl-16 flex-col w-full md:min-w-[120px] justify-between h-full max-w-[500px] 3xl:pt-16 3xl:gap-36'>
            <p
              className='text-secondary-main md:text-sm xl:text-base uppercase indent-14'
              style={{
                wordSpacing: '0.15rem',
              }}
            >
              Passionate programmer with 3+ years of experience in full-stack
              web and mobile app development. I like solving real-world problems
              through code and enjoy collaborating with diverse teams to create
              impactful solutions.
            </p>
            <div className='inline-block'>
              <OutlinedBigIcon text={'DOWNLOAD CV'} />
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
