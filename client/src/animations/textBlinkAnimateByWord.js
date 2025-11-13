import gsap from 'gsap';

function getRandomCharacter() {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return characters.charAt(Math.floor(Math.random() * characters.length));
}

function textBlinkAnimateByWord(element, duration = 1) {
  const originalText = element.textContent;
  element.textContent = '';

  const words = originalText.split(' ');

  const spans = words
    .map((word) => {
      const wordSpan = document.createElement('span');
      wordSpan.style.display = 'inline-block';
      wordSpan.style.whiteSpace = 'nowrap';

      const letterSpans = word.split('').map(() => {
        const span = document.createElement('span');
        span.textContent = getRandomCharacter();
        span.style.display = 'inline-block';
        span.style.opacity = 0;
        wordSpan.appendChild(span);
        return span;
      });

      element.appendChild(wordSpan);
      element.appendChild(document.createTextNode('\u00A0'));

      return letterSpans;
    })
    .flat();

  const tl = gsap.timeline();
  spans.forEach((span, index) => {
    if (span.textContent === '\u00A0') return;

    tl.to(
      span,
      { opacity: 1, duration: duration * 0.1 },
      index * (duration * 0.1)
    );

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
        onStart: () =>
          (span.textContent = originalText.replace(/\s+/g, '').charAt(index)),
      },
      '+=0.02'
    );
  });

  return tl;
}

export { textBlinkAnimateByWord };
