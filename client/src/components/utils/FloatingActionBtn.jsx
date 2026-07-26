import { useEffect, useState, useCallback, useRef } from 'react';
import PrimaryButton from '../Buttons/PrimaryButton';
import { FaAngleDown, FaFigma } from 'react-icons/fa';
import { FaAngleUp } from 'react-icons/fa';
import { MdOutlineArrowOutward } from 'react-icons/md';
import PropTypes from 'prop-types';

const FloatingActionBtn = ({ siteLink, designLink }) => {
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const setScrollOpen = useCallback(() => {
    if (window.scrollY > 200 && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) {
      autoOpenedRef.current = true;
      setOpen(true);
    }
    window.addEventListener('scroll', setScrollOpen);
    return () => {
      window.removeEventListener('scroll', setScrollOpen);
    };
  }, [setScrollOpen]);

  return (
    <div
      className={`fixed bottom-[1%] left-[50%] rounded-xl border border-white/10 bg-primary-dark/90 shadow-lg backdrop-blur-md z-40 w-max duration-500 transition-all transform translate-x-[-50%] pointer-all ${
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
              window.open(siteLink, '_blank', 'noopener,noreferrer');
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
              window.open(designLink, '_blank', 'noopener,noreferrer');
            }}
          />
        )}
        <button
          type='button'
          aria-label={open ? 'Hide project actions' : 'Show project actions'}
          aria-expanded={open}
          className={`absolute left-[100%] rounded-md border border-white/10 bg-primary-dark/90 p-1 opacity-70 shadow-sm backdrop-blur-md duration-500 transition-all hover:opacity-100 ${
            !open ? 'bottom-[100%]' : 'bottom-[45%]'
          }`}
          onClick={() => {
            setOpen((prev) => !prev);
          }}
        >
          <span className='text-primary-main text-xl' aria-hidden='true'>
            {open ? <FaAngleDown /> : <FaAngleUp />}
          </span>
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
