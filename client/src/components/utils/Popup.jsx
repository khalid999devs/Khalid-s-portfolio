import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import PrimaryButton from '../Buttons/PrimaryButton';
import PropTypes from 'prop-types';
import LoadingSpinner from './LoadingSpinner';

const Popup = ({
  text,
  classes = '',
  textClasses = '',
  type = '',
  state,
  setPopup,
  closeText,
  customButtons,
  loading,
  onClose,
}) => {
  const alertRef = useRef();
  const overlayRef = useRef();
  const timeline = useRef();
  const previousFocusRef = useRef(null);
  const wasOpenRef = useRef(false);
  const [isPresent, setIsPresent] = useState(Boolean(state));
  const popupId = useId();
  const titleId = `${popupId}-title`;
  const messageId = `${popupId}-message`;

  const closePop = useCallback(() => {
    setPopup?.((prev) => ({ ...prev, state: false }));
    onClose?.();
  }, [onClose, setPopup]);

  useLayoutEffect(() => {
    if (state && !wasOpenRef.current && !previousFocusRef.current) {
      previousFocusRef.current = document.activeElement;
    }
    wasOpenRef.current = Boolean(state);
  }, [state]);

  useEffect(() => {
    const el = alertRef.current;
    timeline.current?.kill();

    if (state && !isPresent) {
      setIsPresent(true);
      return undefined;
    }
    if (!isPresent || !el) return undefined;

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const duration = reduceMotion ? 0 : state ? 0.2 : 0.3;

    if (state) {
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
          onComplete: () => setIsPresent(false),
        });
    }

    // Cleanup animations on unmount
    return () => {
      timeline?.current?.kill();
      gsap.killTweensOf(el);
    };
  }, [isPresent, state]);

  useLayoutEffect(() => {
    if (!isPresent) return undefined;

    if (!previousFocusRef.current) {
      previousFocusRef.current = document.activeElement;
    }
    const previousBodyOverflow = document.body.style.overflow;
    const overlayElement = overlayRef.current;
    const backgroundElements = Array.from(document.body.children).filter(
      (element) =>
        element !== overlayElement &&
        (!overlayElement || !element.contains(overlayElement))
    );
    const backgroundState = backgroundElements.map((element) => ({
      ariaHidden: element.getAttribute('aria-hidden'),
      element,
      inert: element.inert,
    }));

    document.body.style.overflow = 'hidden';
    backgroundElements.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    if (state) {
      alertRef.current?.focus({ preventScroll: true });
    }

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
      document.body.style.overflow = previousBodyOverflow;
      backgroundState.forEach(({ ariaHidden, element, inert }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      const returnFocusTarget = previousFocusRef.current;
      if (
        returnFocusTarget?.isConnected &&
        typeof returnFocusTarget.focus === 'function'
      ) {
        returnFocusTarget.focus({ preventScroll: true });
      }
    };
  }, [closePop, isPresent, loading, state]);

  useLayoutEffect(() => {
    if (isPresent) return;

    const returnFocusTarget = previousFocusRef.current;
    alertRef.current?.blur();
    if (
      returnFocusTarget?.isConnected &&
      typeof returnFocusTarget.focus === 'function'
    ) {
      returnFocusTarget.focus({ preventScroll: true });
    }
    previousFocusRef.current = null;
  }, [isPresent]);

  const popup = (
    <div
      ref={overlayRef}
      aria-hidden={!isPresent}
      data-portfolio-modal=''
      className={`fixed inset-0 z-[100] items-center justify-center bg-black/65 p-4 ${
        isPresent ? 'flex' : 'hidden'
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
        className={`p-4 px-5 scale-0 opacity-0 flex-col items-center justify-between gap-4 min-h-[200px] max-w-[400px] w-full ${
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
          <LoadingSpinner
            className='w-full flex-grow items-start'
            label={text || 'Request in progress'}
            sizeClass='h-16 w-16'
          />
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

  return createPortal(popup, document.body);
};

Popup.propTypes = {
  text: PropTypes.string,
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
