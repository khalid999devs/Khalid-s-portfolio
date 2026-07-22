import { useCallback, useEffect, useId, useRef } from 'react';
import gsap from 'gsap';
import PrimaryButton from '../Buttons/PrimaryButton';
import { loadingGif } from '../../assets';
import PropTypes from 'prop-types';

const Popup = ({
  text,
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
  const previousFocusRef = useRef(null);
  const popupId = useId();
  const titleId = `${popupId}-title`;
  const messageId = `${popupId}-message`;

  const closePop = useCallback(() => {
    setPopup?.((prev) => ({ ...prev, state: false }));
    onClose?.();
  }, [onClose, setPopup]);

  useEffect(() => {
    const el = alertRef.current;
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const duration = reduceMotion ? 0 : state ? 0.2 : 0.3;

    if (state) {
      if (!previousFocusRef.current) {
        previousFocusRef.current = document.activeElement;
      }
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
            duration,
            onComplete: () => el?.focus(),
          },
          0
        );
    } else {
      timeline.current = gsap.timeline();
      timeline.current
        .to(el, {
          scale: 0,
          opacity: 0,
          duration,
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
  }, [state]);

  useEffect(() => {
    if (!state) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!loading) closePop();
        return;
      }

      if (event.key !== 'Tab' || !alertRef.current) return;
      const focusable = alertRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) {
        event.preventDefault();
        alertRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, [closePop, loading, state]);

  return (
    <div
      aria-hidden={!state}
      className={`fixed inset-0 z-[100] items-center justify-center bg-black/65 p-4 ${
        state ? 'flex' : 'hidden'
      }`}
    >
      <div
        ref={alertRef}
        role={
          type === 'error' || type === 'warning' ? 'alertdialog' : 'dialog'
        }
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex='-1'
        className={`p-4 px-5 flex-col items-center justify-between gap-4 min-h-[200px] max-w-[400px] w-full ${
          type === 'success'
            ? 'bg-green-700'
            : type === 'error'
            ? 'bg-red-700'
            : type === 'warning'
            ? 'bg-orange-500'
            : type === 'normal'
            ? 'bg-secondary-main'
            : 'bg-body-main'
        } shadow-lg rounded-xl ${classes}`}
      >
        <h2 id={titleId} className='sr-only'>
          {loading
            ? 'Request in progress'
            : type === 'error'
            ? 'Error'
            : type === 'warning'
            ? 'Warning'
            : type === 'success'
            ? 'Success'
            : 'Notification'}
        </h2>
        <p
          id={messageId}
          className={`w-full text-lg p-2 text-left ${
            type === 'warning'
              ? 'text-body-main'
              : type === 'normal'
              ? 'text-primary-main'
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
              alt='Loading'
            />
          </div>
        ) : (
          <div className='flex items-center justify-center gap-3 mb-3 w-full'>
            <PrimaryButton
              onClick={closePop}
              text={closeText || 'Ok'}
              classes={
                'bg-onPrimary-main text-body-main py-2! border-secondary-main!'
              }
              textClasses={'text-xs!'}
            />
            {customButtons}
          </div>
        )}
      </div>
    </div>
  );
};

Popup.propTypes = {
  text: PropTypes.string,
  icon: PropTypes.elementType,
  classes: PropTypes.string,
  textClasses: PropTypes.string,
  type: PropTypes.string,
  state: PropTypes.bool,
  setPopup: PropTypes.func,
  closeText: PropTypes.string,
  customButtons: PropTypes.node,
  loading: PropTypes.bool,
  onClose: PropTypes.func,
};

export default Popup;
