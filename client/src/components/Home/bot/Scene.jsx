import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, useProgress } from '@react-three/drei';
import Model from './Model';

function Loader() {
  const { progress } = useProgress();
  return <Html center>{progress.toFixed(1)}%</Html>;
}

const Scene = () => {
  const [showCanvas, setShowCanvas] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCanvas(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return showCanvas ? (
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
  ) : null;
};

export default Scene;
