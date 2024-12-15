import { BiSolidRightArrow } from 'react-icons/bi';

const SectionLabel = ({ text }) => {
  return (
    <div className='flex items-center flex-row gap-1 text-secondary-light text-md text-montreal-mono'>
      <div className='flex gap-[2px] items-center'>
        <span className='opacity-60'>#</span>
        <span className='uppercase'>{text || 'About'}</span>
      </div>
      <div>
        <BiSolidRightArrow className='text-[12px] text-secondary-light' />
      </div>
    </div>
  );
};

export default SectionLabel;
