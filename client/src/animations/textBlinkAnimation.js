import gsap from 'gsap';

function getRandomCharacter() {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return characters.charAt(Math.floor(Math.random() * characters.length));
}

function textBlinkAnimation(element) {
  const originalText = element.textContent;
  element.textContent = '';

  const spans = originalText.split('').map((letter, index) => {
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

    // Letter fades in first
    tl.to(span, { opacity: 1, duration: 0.1 }, index * 0.1);

    // Immediately after appearing, show a random letter, then change to the original letter quickly
    tl.to(
      span,
      {
        duration: 0.02,
        onStart: () => (span.textContent = getRandomCharacter()),
      },
      '+=0.01'
    );
    tl.to(
      span,
      {
        duration: 0.02,
        onStart: () => (span.textContent = originalText[index]),
      },
      '+=0.02'
    );
  });

  return tl;
}

export { textBlinkAnimation };
