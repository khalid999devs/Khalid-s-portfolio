import { useEffect, useState, useCallback } from 'react';
import PrimaryButton from '../Buttons/PrimaryButton';
import { FaAngleDown, FaFigma } from 'react-icons/fa';
import { FaAngleUp } from 'react-icons/fa';
import { MdOutlineArrowOutward } from 'react-icons/md';
import PropTypes from 'prop-types';

const FloatingActionBtn = ({ siteLink, designLink }) => {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  const openIfClosed = useCallback(() => {
    setOpen((prevOpen) => {
      if (!prevOpen) {
        setCount((prevCount) => prevCount + 1);
        return true;
      }
      return prevOpen;
    });
  }, []);

  const setScrollOpen = useCallback(() => {
    if (window.scrollY > 200 && count < 1) openIfClosed();
  }, [count, openIfClosed]);

  useEffect(() => {
    // On a phone it opens by itself, a frame after mounting so it slides in.
    const frame =
      window.innerWidth < 768 ? requestAnimationFrame(openIfClosed) : 0;
    window.addEventListener('scroll', setScrollOpen);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', setScrollOpen);
    };
  }, [setScrollOpen, openIfClosed]);

  // `bg-opacity-40` was removed from the wrapper below. It set
  // --tw-bg-opacity, which only affects a Tailwind bg-* colour utility, and
  // there is none here -- `glass` is not defined in any stylesheet either. It
  // rendered nothing under v3 and would render nothing under v4.
  return (
    <div
      className={`fixed bottom-[1%] left-[50%] glass z-40 w-max duration-500 transition-all transform translate-x-[-50%] pointer-all ${
        open ? 'translate-y-[0%]' : 'translate-y-[105%]'
      }`}
    >
      <div className='flex items-center gap-2 flex-row relative p-1'>
        {siteLink && (
          <PrimaryButton
            text={'Visit Site'}
            Icon={MdOutlineArrowOutward}
            classes={'bg-onPrimary-main rounded-xl!'}
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
            classes={'bg-onPrimary-main rounded-xl!'}
            textClasses={'text-primary-main'}
            onClick={() => {
              window.open(designLink, '_blank');
            }}
          />
        )}
        <button
          className={`absolute left-full p-1 opacity-70 duration-500 transition-all hover:opacity-100 glass rounded-md bg-primary-dark ${
            !open ? 'bottom-full' : 'bottom-[45%]'
          }`}
          onClick={() => {
            setOpen((prev) => !prev);
          }}
          aria-label={open ? 'Hide project links' : 'Show project links'}
          aria-expanded={open}
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
