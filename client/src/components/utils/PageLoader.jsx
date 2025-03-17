import CustomEase from 'gsap/CustomEase';
import { useEffect } from 'react';

const customEase = CustomEase.create('custom', '.87,0,.13,1');

const PageLoader = ({ progress }) => {
  useEffect(() => {
    gsap.to('.progress-bar', {
      width: '100vw',
      duration: 2,
      ease: customEase,
    });
  }, []);

  return (
    <div className='bg-primary-main relative w-screen h-screen z-50'>
      <div className='progress-bar absolute top-1/2 left-0 -tanslate-y-1/2 w-[25vw] p-[2em] flex justify-end lg:justify-between items-center text-primary-main bg-primary-dark'>
        <p className='relative uppercase antialiased grayscale hidden'>
          loading
        </p>
        <p className='relative uppercase antialiased grayscale'>
          <span id='counter'>0</span>
        </p>
      </div>
    </div>
  );
};

export default PageLoader;
