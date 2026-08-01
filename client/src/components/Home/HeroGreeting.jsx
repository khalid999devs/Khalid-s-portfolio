import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { textBlinkAnimation } from '../../animations/textBlinkAnimation';

// The label beside the robot. Every change scrambles in with the same reveal
// the name and role use on first load, so the three read as one effect.
const HeroGreeting = ({ text }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;

    // textBlinkAnimation reads the element's text, so set it before running.
    ref.current.textContent = text;
    const timeline = textBlinkAnimation(ref.current, 0.8);

    return () => timeline?.kill();
  }, [text]);

  // Rendered empty: the effect fills it, exactly as the hero title does.
  //
  // No `capitalize` here, unlike the static text this replaced. The reveal puts
  // every letter in its own inline-block span, and each of those counts as a
  // word start, so the class uppercased the whole phrase. The strings are
  // already cased correctly.
  return <p ref={ref} className='text-lg xl:text-xl' />;
};

HeroGreeting.propTypes = {
  text: PropTypes.string.isRequired,
};

export default HeroGreeting;
