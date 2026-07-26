import { BiSolidRightArrow } from 'react-icons/bi';
import PropTypes from 'prop-types';

const SectionLabel = ({ text, noAnime = false }) => {
  return (
    <div className='flex items-center flex-row gap-1 text-muted-light text-base text-montreal-mono pointer-all'>
      <div className='flex gap-[2px] items-center'>
        <span className='opacity-60'>#</span>
        <span
          className={`uppercase! ${
            noAnime ? '' : 'text-letter-reveal'
          } w-max`}
        >
          {text || 'About'}
        </span>
      </div>
      <div>
        <BiSolidRightArrow className='text-[12px] text-muted-light' />
      </div>
    </div>
  );
};

SectionLabel.propTypes = {
  text: PropTypes.string,
  noAnime: PropTypes.bool,
};

export default SectionLabel;
