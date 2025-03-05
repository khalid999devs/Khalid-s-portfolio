import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function wordBlinkAnimation(
  element,
  isGreaterOrEqualMd,
  parentElement,
  backAnimate = false,
  indent = false
) {
  if (!element || !parentElement) return;

  const originalText = element.textContent.trim();
  element.textContent = '';

  const fragment = document.createDocumentFragment();
  const wordSpans = [];

  originalText.split(' ').forEach((word, index) => {
    const span = document.createElement('span');
    span.textContent = word;
    span.style.display = 'inline-block';
    span.style.opacity = (Math.random() * 0.9).toFixed(2);

    if (index === 0 && indent) {
      span.style.textIndent = isGreaterOrEqualMd ? '56px' : '40px';
    }

    wordSpans.push(span);
    fragment.appendChild(span);

    const space = document.createElement('span');
    space.textContent = '\u00A0';
    space.style.display = 'inline-block';
    fragment.appendChild(space);
  });

  element.appendChild(fragment);

  ScrollTrigger.create({
    trigger: parentElement,
    start: 'top 80%',
    end: 'bottom 20%',
    onEnter: () => animateWordSpans(wordSpans),
    onEnterBack: () => {
      backAnimate && animateWordSpans(wordSpans);
    },
  });
}

export let flickerEase =
  "rough({ template: circ.easeOut, strength: 4, points: 50, taper: 'out', randomize: true, clamp:  true})";

function animateWordSpans(wordSpans) {
  wordSpans.forEach((wordSpan) => {
    const randomDuration = Math.random() * 0.1 + 0.1;
    const randomDelay = Math.random() * 0.3;

    gsap.to(wordSpan, {
      duration: randomDuration,
      opacity: () => Math.random(),
      repeat: 7,
      yoyo: true,
      // stagger: { each: 1, from: 'random' },
      ease: flickerEase,
      // ease: 'power1.inOut',
      delay: randomDelay,
      onComplete: () => gsap.set(wordSpan, { opacity: 1 }),
    });
  });
}
