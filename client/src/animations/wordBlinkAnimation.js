import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { getReducedMotionMediaQuery } from '../utils/motionPreferences';

export function wordBlinkAnimation(
  element,
  isGreaterOrEqualMd,
  parentElement,
  backAnimate = false,
  indent = false,
  indentNum = null
) {
  const motionQuery = getReducedMotionMediaQuery();
  if (!element || !parentElement || motionQuery?.matches) return null;

  const originalText = element.textContent.trim();
  if (!originalText) return null;

  element.textContent = '';

  const fragment = document.createDocumentFragment();
  const wordSpans = [];

  originalText.split(/\s+/).forEach((word, index) => {
    const span = document.createElement('span');
    span.textContent = word;
    span.style.display = 'inline-block';
    span.style.opacity = (Math.random() * 0.25 + 0.65).toFixed(2);

    if (index === 0 && indent) {
      if (!indentNum)
        span.style.textIndent = isGreaterOrEqualMd ? '56px' : '40px';
      else span.style.textIndent = `${indentNum * 4}px`;
    }

    wordSpans.push(span);
    fragment.appendChild(span);

    const space = document.createElement('span');
    space.textContent = '\u00A0';
    space.style.display = 'inline-block';
    fragment.appendChild(space);
  });

  element.appendChild(fragment);

  const activeTweens = new Set();
  let killed = false;

  const animate = () => {
    activeTweens.forEach((tween) => tween.kill());
    activeTweens.clear();
    animateWordSpans(wordSpans, activeTweens, () => killed);
  };

  const scrollTriggerInstance = ScrollTrigger.create({
    trigger: parentElement,
    start: 'top 95%',
    onEnter: animate,
    onEnterBack: () => {
      if (backAnimate) animate();
    },
  });

  const animationHandle = {
    kill() {
      if (killed) return;
      killed = true;
      motionQuery?.removeEventListener?.('change', handleMotionChange);
      scrollTriggerInstance.kill();
      activeTweens.forEach((tween) => tween.kill());
      activeTweens.clear();
      element.textContent = originalText;
    },
  };

  const handleMotionChange = (event) => {
    if (event.matches) animationHandle.kill();
  };
  motionQuery?.addEventListener?.('change', handleMotionChange);

  return animationHandle;
}

const flickerEase =
  "rough({ template: circ.easeOut, strength: 4, points: 50, taper: 'out', randomize: true, clamp:  true})";

function animateWordSpans(wordSpans, activeTweens, isKilled) {
  wordSpans.forEach((wordSpan) => {
    const randomDuration = Math.random() * 0.1 + 0.15;
    const randomDelay = Math.random() * 0.3;

    const tween = gsap.to(wordSpan, {
      duration: randomDuration,
      opacity: () => Math.random() * 0.35 + 0.65,
      repeat: 2,
      yoyo: true,
      ease: flickerEase,
      delay: randomDelay,
      onComplete: () => {
        activeTweens.delete(tween);
        if (!isKilled()) gsap.set(wordSpan, { opacity: 1 });
      },
    });

    activeTweens.add(tween);
  });
}
