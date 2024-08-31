import { useEffect, useRef, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import gsap from 'gsap';
import PrimaryButton from '../Buttons/PrimaryButton';
import { loadingGif } from '../../assets';

const Popup = ({
  text,
  icon,
  classes,
  textClasses,
  type = '',
  state,
  setPopup,
  closeText,
  customButtons,
  loading,
  onClose,
}) => {
  const alertRef = useRef();
  const timeline = useRef();
  const [popOn, setPopOn] = useState(false);

  useEffect(() => {
    const el = alertRef.current;

    // Show or hide the alert based on the state prop
    if (popOn !== state) setPopOn(state);
    if (popOn) {
      timeline.current = gsap.timeline();
      timeline.current
        .to(el, {
          display: 'flex',
        })
        .to(
          el,
          {
            scale: 1,
            opacity: 1,
            duration: 0.2,
          },
          0
        );
    } else {
      timeline.current = gsap.timeline();
      timeline.current
        .to(el, {
          scale: 0,
          opacity: 0,
          duration: 0.3,
        })
        .to(el, {
          display: 'none',
        });
    }

    // Cleanup animations on unmount
    return () => {
      timeline?.current?.kill();
      gsap.killTweensOf(el);
    };
  }, [state, popOn]);

  // Close the alert manually
  const closePop = () => {
    setPopOn(false);
    setPopup((prev) => ({ ...prev, state: false }));
    if (onClose) onClose();
  };

  return (
    // <div className='fixed '>
    <div
      ref={alertRef}
      className={`p-4 px-5 hidden flex-col items-center justify-between gap-4 min-h-[200px] max-w-[400px] w-full ${
        type === 'success'
          ? 'bg-green-600'
          : type === 'error'
          ? 'bg-red-700'
          : type === 'warning'
          ? 'bg-orange-500'
          : type === 'normal'
          ? 'bg-secondary-main'
          : 'bg-text-main'
      } shadow-lg rounded-xl fixed top-[50%] z-50 left-[50%] ${classes}`}
      style={{ transform: 'translate(-50%,-50%)' }}
    >
      <p
        className={`w-full text-lg p-2 text-left ${
          type === 'warning'
            ? 'text-text-main'
            : type === 'normal'
            ? 'text-tertiary-main'
            : 'text-primary-main'
        } ${textClasses}`}
      >
        {text || 'Pop up text'}
      </p>

      {loading ? (
        <div className='w-full flex-grow flex items-start justify-center'>
          <img
            src={loadingGif}
            className='w-[100px] h-[100px]'
            alt='loading img'
          />
        </div>
      ) : (
        <div className='flex items-center justify-center gap-3 mb-3 w-full'>
          <PrimaryButton
            onClick={closePop}
            text={closeText || 'Ok'}
            classes={
              'bg-onPrimary-main text-body-main !py-2 !border-secondary-main'
            }
            textClasses={'!text-xs'}
          />
          {customButtons}
        </div>
      )}
    </div>
    // </div>
  );
};

export default Popup;
