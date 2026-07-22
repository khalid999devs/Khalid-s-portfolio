import { useEffect, useRef, useState } from 'react';
import NavLogo from './Admin/NavLogo';
import { Link } from 'react-router-dom';
import { OutlinedSmallButton } from '../Buttons/OutlinedButton';
import PageNav from './PageNav';
import { wordBlinkAnimation } from '../../animations/wordBlinkAnimation';
import { isUpwork } from '../../config';
import { upworkedSocialLinks } from '../../Constants';
import { myResume } from '../../assets';

const Navbar = () => {
  const [isPageMenu, setIsPageMenu] = useState(false);
  const navBarRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    let unlockTimer;

    if (isPageMenu) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      unlockTimer = setTimeout(() => {
        document.body.style.overflow = 'auto';
        document.body.style.position = '';
        document.body.style.width = '';
      }, 1000);
    }

    return () => clearTimeout(unlockTimer);
  }, [isPageMenu]);

  useEffect(() => {
    if (navBarRef.current) {
      const animatingElements = [
        ...document.querySelectorAll('.blink-animate-nav'),
      ];

      if (animatingElements.length > 0) {
        animatingElements.forEach((ele) => {
          wordBlinkAnimation(ele, null, navBarRef.current, false, false);
        });
      }
    }
  }, []);

  return (
    <>
      <header ref={navBarRef} className='w-full fixed top-0 left-0 z-50'>
        <nav
          aria-label='Primary navigation'
          className='screen-max-width py-3.5 sec-x-padding flex items-center justify-between mix-blend-difference'
        >
          <div>
            <NavLogo />
          </div>
          <div className='hidden sm:inline-block'>
            <OutlinedSmallButton
              text={'My Resume'}
              onClick={() => {
                window.open(myResume, '_blank', 'noopener,noreferrer');
              }}
            />
          </div>
          <div className='flex items-center justify-between gap-6 text-sm'>
            <Link
              to={'/projects'}
              className='blink-animate-nav text-flicker !hidden sm:!inline '
            >
              Projects
            </Link>
            {!isUpwork ? (
              <a
                href='mailto:khalidahammeduzzal@gmail.com'
                className=' blink-animate-nav text-flicker !hidden sm:!inline'
              >
                Email Me
              </a>
            ) : (
              <a
                href={upworkedSocialLinks[0].path}
                target='_blank'
                rel='noopener noreferrer'
                className='transition-all blink-animate-nav duration-300 text-xs sm:text-sm text-flicker pointer-all'
              >
                {upworkedSocialLinks[0].title}
              </a>
            )}

            {/* hamburger */}
            <button
              ref={menuButtonRef}
              type='button'
              aria-label='Open site menu'
              aria-haspopup='dialog'
              aria-expanded={isPageMenu}
              aria-controls='site-menu'
              className='w-8 h-auto grid gap-1.5 select-none cursor-pointer'
              onClick={() => {
                setIsPageMenu(true);
                // document.body.style.overflowY = 'hidden';
              }}
            >
              <span
                aria-hidden='true'
                className='w-full h-[1px] bg-onPrimary-dark'
              ></span>
              <span
                aria-hidden='true'
                className='w-full h-[1px] bg-onPrimary-dark'
              ></span>
              <span
                aria-hidden='true'
                className='w-full h-[1px] bg-onPrimary-dark'
              ></span>
            </button>
          </div>
        </nav>
      </header>
      {/* nav menu page */}
      <PageNav
        isPageMenu={isPageMenu}
        setIsPageMenu={setIsPageMenu}
        triggerRef={menuButtonRef}
      />
    </>
  );
};

export default Navbar;
