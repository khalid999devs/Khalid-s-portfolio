/* eslint-disable react/no-unknown-property */
import { Component, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, useProgress } from '@react-three/drei';
import PropTypes from 'prop-types';
import Model from './Model';

const SceneFallback = () => (
  <div className='w-full h-full' aria-hidden='true' />
);

function ModelLoader() {
  const { progress } = useProgress();
  const safeProgress = Number.isFinite(progress) ? Math.round(progress) : 0;

  return <Html center>{safeProgress}%</Html>;
}

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <SceneFallback />;
    return this.props.children;
  }
}

SceneErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

const Scene = ({ onLoad, isActive }) => (
  <div
    className={`w-full h-full transition-all duration-300 ${
      isActive ? 'scale-110' : 'scale-100'
    }`}
  >
    <SceneErrorBoundary>
      <Canvas
        dpr={[1, 1.5]}
        fallback={<SceneFallback />}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 5] }}
        className='w-full h-full'
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Suspense fallback={<ModelLoader />}>
          <Model position={[0, -0.5, 0]} onLoad={onLoad} />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
  </div>
);

Scene.propTypes = {
  onLoad: PropTypes.func,
  isActive: PropTypes.bool,
};

export default Scene;
