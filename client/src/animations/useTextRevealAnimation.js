import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

function getRandomCharacter() {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return characters.charAt(Math.floor(Math.random() * characters.length));
}

function useTextRevealAnimation(className, duration = 0.1) {
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const animations = new Set();
    let animationFrameId;

    const updateAnimations = () => {
      animationFrameId = undefined;

      animations.forEach((animation) => {
        if (animation.element.isConnected) return;
        animation.trigger.kill();
        animation.timeline.kill();
        animations.delete(animation);
      });

      const elements = document.querySelectorAll(`.${className}`);
      if (!elements.length) return;

      let createdAnimation = false;

      elements.forEach((element) => {
        if (element.dataset.animated) return;
        element.dataset.animated = 'true';

        const originalText = element.textContent;
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

        const tl = gsap.timeline({ paused: true });
        spans.forEach((span, index) => {
          if (span.textContent === '\u00A0') return;

          tl.to(span, { opacity: 1, duration }, index * duration);
          tl.to(
            span,
            {
              duration: duration / 5,
              onStart: () => (span.textContent = getRandomCharacter()),
            },
            '+=0.01'
          );
          tl.to(
            span,
            {
              duration: duration / 5,
              onStart: () => (span.textContent = originalText[index]),
            },
            '+=0.02'
          );
        });

        const scrollTriggerInstance = ScrollTrigger.create({
          trigger: element,
          start: 'top bottom',
          onEnter: () => tl.play(),
          onLeaveBack: () => tl.seek(0).pause(),
          toggleActions: 'play none none none',
        });

        animations.add({
          element,
          originalText,
          previousAriaLabel,
          timeline: tl,
          trigger: scrollTriggerInstance,
        });
        createdAnimation = true;
      });

      if (createdAnimation) ScrollTrigger.refresh();
    };

    const scheduleUpdate = () => {
      if (animationFrameId !== undefined) return;
      animationFrameId = window.requestAnimationFrame(updateAnimations);
    };

    updateAnimations();

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      animations.forEach(
        ({
          element,
          originalText,
          previousAriaLabel,
          timeline,
          trigger,
        }) => {
          trigger.kill();
          timeline.kill();

          if (element.isConnected) {
            element.textContent = originalText;
            delete element.dataset.animated;
            if (previousAriaLabel === null) {
              element.removeAttribute('aria-label');
            } else {
              element.setAttribute('aria-label', previousAriaLabel);
            }
          }
        }
      );
    };
  }, [className, duration, prefersReducedMotion]);
}

export default useTextRevealAnimation;
