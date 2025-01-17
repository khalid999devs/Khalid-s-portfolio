import React, { useEffect, useState } from 'react';
import SectionLabel from '../utils/SectionLabel';
import { OutlinedSmallButton } from '../Buttons/OutlinedButton';
import { useAppContext } from '../../App';
import { workingFields } from '../../Constants';

const SkillsAndTechs = () => {
  const [technologies, setTechnologies] = useState([]);
  const { settings } = useAppContext();

  useEffect(() => {
    let techs = settings?.technologies;

    if (techs) {
      setTechnologies([techs.Languages, techs.Frontend, techs.Backend]);
    }
  }, [settings]);

  return (
    <div className='w-full mt-4'>
      <div className='w-full mb-8 flex items-start justify-between flex-col md:flex-row gap-8 md:gap-28 lg:gap-36 '>
        <div className=''>
          <SectionLabel text='Skills' />
        </div>

        <div className='w-full md:w-[73%] text-pp-eiko text-2xl uppercase md:pl-3'>
          {workingFields}
        </div>
      </div>

      <div className='w-full mb-8 mt-20 md:mt-24 flex items-start justify-between flex-col md:flex-row gap-8 md:gap-20 lg:gap-36 '>
        <div className=''>
          <SectionLabel text='Technologies' />
        </div>

        <div className='w-full md:w-[73%] flex flex-col items-start justify-start gap-7 md:pl-3'>
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
  );
};

export default SkillsAndTechs;
