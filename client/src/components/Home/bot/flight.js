import gsap from 'gsap';

// How fast the bot is moving on screen, in px/s. Model.jsx leans it by this.
export const flight = { vx: 0, vy: 0 };

// A spring pulls the bot to its target. Slightly underdamped, so it overshoots
// a little and settles, the way something hovering does.
const STIFFNESS = 64;
const DAMPING = 12;
const STEP = 1 / 120;
const LONGEST_FRAME = 0.05;

// It hovers beside the pointer, not on it, and swaps sides near an edge.
const HOVER_X = 62;
const HOVER_Y = 48;
// How close its centre may come to each edge. The right one keeps its box
// inside the page, which would otherwise gain a horizontal scrollbar.
const EDGE = { left: 70, right: 140, top: 90, bottom: 70 };

const DRIFT_X = 7;
const DRIFT_Y = 5;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Flies `element` after the mouse pointer and back to where it sits. */
export const createFollower = (element) => {
  // Offset from the resting place and speed, both in screen pixels.
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;

  let homeX = 0;
  let homeY = 0;
  let scale = 1;
  let viewWidth = 0;
  let viewHeight = 0;
  let scrollX = 0;
  let scrollY = 0;

  let pointerX = 0;
  let pointerY = 0;
  let pointerKnown = false;
  let following = false;
  let running = false;

  // The short swell that answers the click.
  const pulse = { size: 1 };

  // Kept from the scroll event, so no frame has to ask the page for it.
  const onScroll = () => {
    scrollX = window.scrollX;
    scrollY = window.scrollY;
  };

  // The resting place in page coordinates. Ancestors scale the element, so a
  // pixel of its own movement is `scale` pixels on screen.
  const measure = () => {
    onScroll();
    const box = element.getBoundingClientRect();
    const parent = element.parentElement;
    scale = parent?.offsetWidth
      ? parent.getBoundingClientRect().width / parent.offsetWidth
      : 1;
    homeX = box.left + box.width / 2 - x + scrollX;
    homeY = box.top + box.height / 2 - y + scrollY;
    viewWidth = document.documentElement.clientWidth;
    viewHeight = window.innerHeight;
  };

  const onPointerMove = (event) => {
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    pointerKnown = true;
  };

  // Left exactly as it was before the first flight.
  const land = () => {
    gsap.ticker.remove(tick);
    gsap.killTweensOf(pulse);
    running = false;
    x = y = vx = vy = 0;
    flight.vx = flight.vy = 0;
    element.style.transform = '';
    delete element.dataset.flying;
  };

  function tick(time, deltaMs) {
    let targetX = 0;
    let targetY = 0;

    if (following && pointerKnown) {
      const right = pointerX + HOVER_X <= viewWidth - EDGE.right;
      const above = pointerY - HOVER_Y >= EDGE.top;
      const hoverX = pointerX + (right ? HOVER_X : -HOVER_X) + Math.sin(time * 2.3) * DRIFT_X;
      const hoverY = pointerY + (above ? -HOVER_Y : HOVER_Y) + Math.sin(time * 3.7 + 1) * DRIFT_Y;

      targetX = clamp(hoverX, EDGE.left, viewWidth - EDGE.right) + scrollX - homeX;
      targetY = clamp(hoverY, EDGE.top, viewHeight - EDGE.bottom) + scrollY - homeY;
    }

    // Fixed steps, so it moves the same at 60 Hz and 144 Hz.
    let remaining = Math.min(deltaMs / 1000, LONGEST_FRAME);
    while (remaining > 1e-6) {
      const dt = Math.min(remaining, STEP);
      vx += (STIFFNESS * (targetX - x) - DAMPING * vx) * dt;
      vy += (STIFFNESS * (targetY - y) - DAMPING * vy) * dt;
      x += vx * dt;
      y += vy * dt;
      remaining -= dt;
    }

    const home = !following && Math.abs(x) < 0.5 && Math.abs(y) < 0.5;
    if (home && Math.abs(vx) < 6 && Math.abs(vy) < 6) {
      land();
      return;
    }

    // The element's own `translate` centres it; this goes on top of that.
    element.style.transform = `translate3d(${(x / scale).toFixed(2)}px, ${(y / scale).toFixed(2)}px, 0) scale(${pulse.size.toFixed(4)})`;
    flight.vx = vx;
    flight.vy = vy;
  }

  return {
    /** Starts following. `event` is the click that asked for it. */
    follow(event) {
      following = true;
      pointerKnown = false;
      if (event) onPointerMove(event);
      measure();
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', measure);

      // While it flies the page beneath stays usable.
      element.dataset.flying = '';
      gsap.fromTo(
        pulse,
        { size: 1 },
        { size: 1.1, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.inOut' }
      );
      if (!running) {
        running = true;
        gsap.ticker.add(tick);
      }
    },

    /** Sends it home; it lands by itself. */
    release() {
      following = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    },

    destroy() {
      this.release();
      if (running) land();
    },
  };
};
