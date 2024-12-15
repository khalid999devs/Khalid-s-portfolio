import React from 'react';
import SectionLabel from '../utils/SectionLabel';
import { OutlinedSmallButton } from '../Buttons/OutlinedButton';

const SkillsAndTechs = () => {
  return (
    <div className='w-full mt-4'>
      <div className='w-full mb-8 flex items-start justify-between flex-col md:flex-row gap-10 md:gap-28 lg:gap-36 '>
        <div className=''>
          <SectionLabel text='Skills' />
        </div>

        <div className='w-full md:w-[73%] text-pp-eiko text-2xl uppercase md:pl-3'>
          Website Development—Web Application & Software
          Development—UI/UX—Mobile App Development
        </div>
      </div>

      <div className='w-full mb-8 mt-24 flex items-start justify-between flex-col md:flex-row gap-10 md:gap-28 lg:gap-36 '>
        <div className=''>
          <SectionLabel text='Technologies' />
        </div>

        <div className='w-full md:w-[73%] flex flex-col items-start justify-start gap-4 md:pl-3'>
          <div className='flex flex-row flex-wrap gap-2.5'>
            <OutlinedSmallButton text={'REACT JS'} classes={`uppercase`} />
            <OutlinedSmallButton text={'REACT JS'} classes={`uppercase`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillsAndTechs;
