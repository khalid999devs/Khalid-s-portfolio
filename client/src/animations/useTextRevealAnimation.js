import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function getRandomCharacter() {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return characters.charAt(Math.floor(Math.random() * characters.length));
}

function useTextRevealAnimation(className, duration = 0.1) {
  useEffect(() => {
    const scrollTriggers = [];

    const updateAnimations = () => {
      const elements = document.querySelectorAll(`.${className}`);
      if (!elements.length) return;

      elements.forEach((element) => {
        if (element.dataset.animated) return;
        element.dataset.animated = 'true';

        const originalText = element.textContent;
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

        scrollTriggers.push(scrollTriggerInstance);
      });
    };

    updateAnimations();

    const observer = new MutationObserver(updateAnimations);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      scrollTriggers.forEach((trigger) => trigger.kill());
    };
  }, [className, duration]);
}

export default useTextRevealAnimation;
