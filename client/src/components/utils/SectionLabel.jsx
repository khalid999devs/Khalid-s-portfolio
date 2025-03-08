import { useEffect, useRef } from 'react';
import { BiSolidRightArrow } from 'react-icons/bi';
import { textBlinkAnimation } from '../../animations/textBlinkAnimation';

const SectionLabel = ({ text }) => {
  const sectionLabel = useRef(null);
  // useEffect(() => {
  //   if (sectionLabel.current) {
  //     textBlinkAnimation(sectionLabel.current);
  //   }
  // }, []);

  return (
    <div className='flex items-center flex-row gap-1 text-secondary-light text-md text-montreal-mono pointer-all'>
      <div className='flex gap-[2px] items-center'>
        <span className='opacity-60'>#</span>
        <span
          ref={sectionLabel}
          className='!uppercase text-letter-reveal w-max'
        >
          {text || 'About'}
        </span>
      </div>
      <div>
        <BiSolidRightArrow className='text-[12px] text-secondary-light' />
      </div>
    </div>
  );
};

export default SectionLabel;
