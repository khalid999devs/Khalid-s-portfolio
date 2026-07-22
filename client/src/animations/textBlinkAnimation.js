import gsap from 'gsap';
import { getReducedMotionMediaQuery } from '../utils/motionPreferences';

function getRandomCharacter() {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return characters.charAt(Math.floor(Math.random() * characters.length));
}

function textBlinkAnimation(element, duration = 1) {
  const motionQuery = getReducedMotionMediaQuery();
  if (!element || motionQuery?.matches) return null;

  const originalText = element.textContent;
  if (!originalText) return null;

  const previousAriaLabel = element.getAttribute('aria-label');
  element.setAttribute('aria-label', originalText);
  element.textContent = '';

  const spans = originalText.split('').map((letter) => {
    const span = document.createElement('span');
    span.textContent = letter === ' ' ? '\u00A0' : getRandomCharacter();
    span.style.display = 'inline-block';
    span.style.opacity = '0';
    element.appendChild(span);
    return span;
  });

  const tl = gsap.timeline();
  spans.forEach((span, index) => {
    if (span.textContent === '\u00A0') return;

    // Letter fades in first, speed controlled by duration
    tl.to(
      span,
      { opacity: 1, duration: duration * 0.1 },
      index * (duration * 0.1)
    );

    // Immediately after appearing, show a random letter, then change to the original letter quickly
    tl.to(
      span,
      {
        duration: duration * 0.02,
        onStart: () => (span.textContent = getRandomCharacter()),
      },
      '+=0.01'
    );
    tl.to(
      span,
      {
        duration: duration * 0.02,
        onStart: () => (span.textContent = originalText[index]),
      },
      '+=0.02'
    );
  });

  let killed = false;
  const animationHandle = {
    kill() {
      if (killed) return;
      killed = true;
      motionQuery?.removeEventListener?.('change', handleMotionChange);
      tl.kill();
      element.textContent = originalText;
      if (previousAriaLabel === null) {
        element.removeAttribute('aria-label');
      } else {
        element.setAttribute('aria-label', previousAriaLabel);
      }
    },
  };

  const handleMotionChange = (event) => {
    if (event.matches) animationHandle.kill();
  };
  motionQuery?.addEventListener?.('change', handleMotionChange);

  return animationHandle;
}

export { textBlinkAnimation };
