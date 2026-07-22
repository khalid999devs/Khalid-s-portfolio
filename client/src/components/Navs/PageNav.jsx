import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import NavLogo from './Admin/NavLogo';
import {
  pageNavLinks,
  socialLinks,
  upworkedSocialLinks,
} from '../../Constants';
import { NavLink } from 'react-router-dom';
import { MdOutlineArrowRightAlt } from 'react-icons/md';
import { BiSolidRightArrow } from 'react-icons/bi';
import { OutlinedSmallButton } from '../Buttons/OutlinedButton';
import { isUpwork } from '../../config';
import { formatBangladeshTime } from '../../utils/bangladeshTime';
import gsap from 'gsap';
import PropTypes from 'prop-types';

const calculateRandomBlockDelay = (rowIndex, totalRows) => {
  const blockDelay = Math.random() * 0.5;
  const rowDelay = (totalRows - rowIndex - 1) * 0.05;
  return blockDelay + rowDelay;
};

const PageNav = ({ isPageMenu, setIsPageMenu, classes, triggerRef }) => {
  const timeRef = useRef(null);
  const contactTitleRef = useRef(null);
  const menuRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isPageMenu) return undefined;

    const triggerElement = triggerRef?.current;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsPageMenu(false);
        return;
      }

      if (event.key !== 'Tab' || !menuRef.current) return;

      const focusableElements = menuRef.current.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerElement?.focus();
    };
  }, [isPageMenu, setIsPageMenu, triggerRef]);

  useEffect(() => {
    let iid;
    const timeContainer = timeRef.current;
    if (timeContainer) {
      iid = setInterval(() => {
        timeContainer.innerText = formatBangladeshTime();
      }, 1000);
    }

    return () => {
      if (iid) {
        clearInterval(iid);
      }
    };
  }, [isPageMenu]);

  useEffect(() => {
    const animations = [];

    if (contactTitleRef.current) {
      const anim = gsap.fromTo(
        contactTitleRef.current,
        {
          transform:
            'scale(1,1.3) rotate(90deg) translateY(40%) translateX(-57%)',
        },
        {
          transform:
            'scale(1,1.3) rotate(90deg) translateY(-14%) translateX(-57%)',
          duration: 0.8,
          delay: 0.5,
        }
      );
      animations.push(anim);
    }

    const pageNavLinks = gsap.utils.toArray('.page-nav-links');
    if (pageNavLinks.length) {
      const anim = gsap.fromTo(
        pageNavLinks,
        {
          translateX: '20%',
          opacity: 0,
        },
        {
          translateX: 0,
          opacity: 1,
          delay: 0.2,
          stagger: 0.1,
          duration: 0.8,
          ease: 'back.in',
        }
      );
      animations.push(anim);
    }

    // Cleanup function to kill all animations
    return () => {
      animations.forEach((anim) => {
        if (anim && anim.kill) {
          anim.kill();
        }
      });
    };
  }, [isPageMenu]);

  const handleHamburgerClick = () => {
    setIsPageMenu(false);
  };

  return (
    <AnimatePresence key={5435342}>
      {/* PageNav menu with sliding animation */}
      {isPageMenu && (
        <motion.div
          ref={menuRef}
          id='site-menu'
          role='dialog'
          aria-modal='true'
          aria-label='Site menu'
          className={`transition-all duration-700 grid grid-rows-[auto_1fr] min-h-screen w-full sec-x-padding fixed top-0 left-0 bg-body-main screen-max-width z-50 ${
            classes || ''
          }`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transform: 'translateY(100%)' }}
          transition={{
            duration: 1,
            ease: 'easeInOut',
          }}
        >
          {/* nav controls */}
          <div className='w-full py-4 flex items-center justify-between mix-blend-difference'>
            <div>
              <NavLogo
                onClick={() => {
                  document.body.style.overflowY = 'scroll';
                  setIsPageMenu(false); // Close menu on logo click
                }}
              />
            </div>

            <div className='flex items-center text-sm'>
              {/* hamburger */}
              <button
                ref={closeButtonRef}
                type='button'
                aria-label='Close site menu'
                className='w-8 min-h-8 h-fit relative cursor-pointer opacity-80 duration-500 hover:opacity-100'
                onClick={handleHamburgerClick}
              >
                <span
                  aria-hidden='true'
                  className='w-full h-[1px] bg-onPrimary-dark absolute top-1/2 left-0 -translate-y-1/2 -rotate-45'
                ></span>
                <span
                  aria-hidden='true'
                  className='w-full h-[1px] bg-onPrimary-dark absolute top-1/2 left-0 -translate-y-1/2 rotate-45'
                ></span>
              </button>
            </div>
          </div>

          {/* menus */}
          <div className='w-full h-full grid grid-cols-1 md:grid-cols-[1fr_1.25fr]'>
            <nav
              aria-label='Site pages'
              className='pt-10 w-full flex flex-col gap-1 md:gap-8 text-montreal-mono'
            >
              {pageNavLinks.map((item, key) => (
                <NavLink
                  className={({ isActive }) =>
                    `page-nav-links text-[2.6rem] md:text-5xl ${
                      isActive ? 'opacity-100 underline' : 'opacity-55'
                    } hover:opacity-100 transition-all duration-300 hover:underline underline-offset-4 uppercase select-none inline w-fit `
                  }
                  onClick={() => setIsPageMenu(false)} // Close menu on link click
                  to={item.path}
                  key={key}
                >
                  {item.title}
                </NavLink>
              ))}
            </nav>

            <div className='md:border-l-[1px] border-secondary-light overflow-hidden relative md:pl-28 flex flex-col justify-end items-start'>
              <h2
                className='text-7xl uppercase text-primary-main opacity-90 tracking-wide absolute left-0 hidden md:inline-block select-none'
                id={'contact-title'}
                ref={contactTitleRef}
                style={{
                  transform:
                    'scale(1,1.3) rotate(90deg) translateY(-12%) translateX(-57%)',
                  transformOrigin: 'left',
                  top: '50%',
                }}
              >
                Contact
              </h2>

              <div className='flex flex-col gap-9 md:gap-14 pb-8 mb-9 md:mb-0'>
                <div className='flex flex-col gap-4 md:gap-8'>
                  <div className='flex items-center md:justify-start gap-1 -translate-x-1 group'>
                    <MdOutlineArrowRightAlt
                      aria-hidden='true'
                      className='text-white text-4xl transition-transform duration-1000 group-hover:translate-x-1'
                    />
                    <a
                      href='mailto:khalidahammeduzzal@gmail.com'
                      className='text-lg md:text-2xl text-pp-eiko uppercase text-flicker thick-underline'
                    >
                      SEND ME AN EMAIL
                    </a>
                  </div>

                  <div className='flex w-full flex-col text-muted-light gap-2 md:gap-3 '>
                    <p className='text-[10px] md:text-xs text-montreal-mono'>
                      BASED IN BANGLADESH — WORKING WORLDWIDE
                    </p>
                    <div className='flex items-center gap-4'>
                      <div className='flex item-center gap-1 '>
                        <p className='text-[10px] md:text-xs text-montreal-mono'>
                          LOCAL TIME
                        </p>
                        <BiSolidRightArrow
                          aria-hidden='true'
                          className='text-[10px] md:text-xs mt-0.5'
                        />
                      </div>
                      <p
                        className='text-white text-xs'
                        ref={timeRef}
                        aria-label='Local time in Bangladesh'
                      >
                        {formatBangladeshTime()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className='flex flex-row items-end justify-start gap-3'>
                  {(isUpwork ? upworkedSocialLinks : socialLinks).map(
                    (item, key) => (
                      <OutlinedSmallButton
                        key={key}
                        text={item.title}
                        onClick={() =>
                          window.open(
                            item.path,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Page transition animation */}
      {isPageMenu && (
        <div
          className='page-blocks-container transition-in'
          key={423}
          aria-hidden='true'
        >
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <div className='row' key={rowIndex}>
              {Array.from({ length: 11 }).map((_, blockIndex) => (
                <motion.div
                  key={blockIndex}
                  className='block-motion'
                  initial={{ scaleY: 1 }}
                  animate={{ scaleY: 0 }}
                  exit={{ scaleY: 0 }}
                  transition={{
                    duration: 1,
                    ease: [0.22, 1, 0.36, 1],
                    delay: calculateRandomBlockDelay(rowIndex, 10),
                  }}
                ></motion.div>
              ))}
            </div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};

PageNav.propTypes = {
  isPageMenu: PropTypes.bool,
  setIsPageMenu: PropTypes.func,
  classes: PropTypes.string,
  triggerRef: PropTypes.shape({
    current: PropTypes.object,
  }),
};

export default PageNav;
