/* eslint-disable react/no-unknown-property */
import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, useProgress } from '@react-three/drei';
import Model from './Model';
import PropTypes from 'prop-types';

function Loader() {
  const { progress } = useProgress();
  return <Html center>{progress.toFixed(1)}%</Html>;
}

const Scene = ({ onLoad, isActive }) => {
  const [showCanvas, setShowCanvas] = useState(false);

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

  return showCanvas ? (
    <div
      className={`w-full h-full transition-all duration-300 ${
        isActive ? 'scale-110' : 'scale-100'
      }`}
    >
      <Canvas
        gl={{ antialias: true }}
        camera={{ position: [0, 0, 5] }}
        className='w-full h-full'
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
