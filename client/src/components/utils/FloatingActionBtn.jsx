import { useEffect, useState, useCallback } from 'react';
import PrimaryButton from '../Buttons/PrimaryButton';
import { FaAngleDown, FaFigma } from 'react-icons/fa';
import { FaAngleUp } from 'react-icons/fa';
import { MdOutlineArrowOutward } from 'react-icons/md';
import PropTypes from 'prop-types';

const FloatingActionBtn = ({ siteLink, designLink }) => {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  const setScrollOpen = useCallback(() => {
    if (window.scrollY > 200 && count < 1) {
      setOpen((prevOpen) => {
        if (!prevOpen) {
          setCount((prevCount) => prevCount + 1);
          return true;
        }
        return prevOpen;
      });
    }
  }, [count]);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setOpen((prevOpen) => {
        if (!prevOpen) {
          setCount((prevCount) => prevCount + 1);
          return true;
        }
        return prevOpen;
      });
    }
    window.addEventListener('scroll', setScrollOpen);
    return () => {
      window.removeEventListener('scroll', setScrollOpen);
    };
  }, [setScrollOpen]);

  return (
    <div
      className={`fixed bottom-[1%] left-[50%] glass bg-opacity-40 z-40 w-max duration-500 transition-all transform translate-x-[-50%] pointer-all ${
        open ? 'translate-y-[0%]' : 'translate-y-[105%]'
      }`}
    >
      <div className='flex items-center gap-2 flex-row relative p-1'>
        {siteLink && (
          <PrimaryButton
            text={'Visit Site'}
            Icon={MdOutlineArrowOutward}
            classes={'bg-onPrimary-main !rounded-xl'}
            textClasses={'text-primary-main'}
            onClick={() => {
              window.open(siteLink, '_blank');
            }}
          />
        )}
        {designLink && (
          <PrimaryButton
            text={'Design'}
            Icon={FaFigma}
            classes={'bg-onPrimary-main !rounded-xl'}
            textClasses={'text-primary-main'}
            onClick={() => {
              window.open(designLink, '_blank');
            }}
          />
        )}
        <button
          className={`absolute left-[100%] p-1 opacity-70 duration-500 transition-all hover:opacity-100 glass rounded-md bg-primary-dark ${
            !open ? 'bottom-[100%]' : 'bottom-[45%]'
          }`}
          onClick={() => {
            setOpen((prev) => !prev);
          }}
        >
          <p className='text-primary-main text-xl'>
            {open ? <FaAngleDown /> : <FaAngleUp />}
          </p>
        </button>
      </div>
    </div>
  );
};

FloatingActionBtn.propTypes = {
  siteLink: PropTypes.string,
  designLink: PropTypes.string,
};

export default FloatingActionBtn;
