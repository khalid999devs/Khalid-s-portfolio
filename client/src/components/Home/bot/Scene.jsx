/* eslint-disable react/no-unknown-property */
import {
  Suspense,
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Model from './Model';
import { getProgress, subscribeProgress } from './modelSource';
import PropTypes from 'prop-types';

function Loader() {
  const progress = useSyncExternalStore(subscribeProgress, getProgress);
  return <Html center>{progress.toFixed(1)}%</Html>;
}

const Scene = ({ onLoad, isActive }) => {
  const [showCanvas, setShowCanvas] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCanvas(true);
      // Call onLoad after canvas is shown and model should be loaded
      setTimeout(() => {
        if (onLoad) onLoad();
      }, 1000); // Give time for model to load
    }, 1200);
    return () => clearTimeout(timer);
  }, [onLoad]);

  // Nothing to draw for a bot nobody can see.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: '200px' }
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [showCanvas]);

  return showCanvas ? (
    <div
      ref={wrapperRef}
      className={`w-full h-full transition-all duration-300 ${
        isActive ? 'scale-110' : 'scale-100'
      }`}
    >
      <Canvas
        gl={{ antialias: true }}
        camera={{ position: [0, 0, 5] }}
        className='w-full h-full'
        frameloop={onScreen ? 'always' : 'never'}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Suspense fallback={<Loader />}>
          <Model position={[0, -0.5, 0]} />
        </Suspense>
      </Canvas>
    </div>
  ) : null;
};

Scene.propTypes = {
  onLoad: PropTypes.func,
  isActive: PropTypes.bool,
};

export default Scene;
