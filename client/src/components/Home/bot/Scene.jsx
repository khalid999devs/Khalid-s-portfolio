import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationMixer,
  DirectionalLight,
  PerspectiveCamera,
  Scene as ThreeScene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';
import PropTypes from 'prop-types';

const SceneFallback = () => (
  <div className='w-full h-full' aria-hidden='true' />
);

const disposeModel = (model) => {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  model.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
};

const Scene = ({ onLoad, isActive }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed) return undefined;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) return undefined;

    let renderer;
    let resizeObserver;
    let visibilityObserver;
    let animationFrame;
    let entranceTween;
    let mixer;
    let model;
    let disposed = false;
    let isIntersecting = true;
    let isRunning = false;
    let previousTime = performance.now();

    const scene = new ThreeScene();
    const camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const ambientLight = new AmbientLight(0xffffff, 0.5);
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(ambientLight, directionalLight);

    const renderFrame = (time) => {
      if (!isRunning || disposed) return;

      const delta = Math.min((time - previousTime) / 1000, 0.1);
      previousTime = time;
      mixer?.update(delta);
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderFrame);
    };

    const updateRenderLoop = () => {
      const shouldRun =
        Boolean(model) && !document.hidden && isIntersecting && !disposed;

      if (shouldRun && !isRunning) {
        isRunning = true;
        previousTime = performance.now();
        animationFrame = window.requestAnimationFrame(renderFrame);
      } else if (!shouldRun && isRunning) {
        isRunning = false;
        window.cancelAnimationFrame(animationFrame);
      }
    };

    const resize = () => {
      if (!renderer || disposed) return;

      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const handleContextLost = (event) => {
      event.preventDefault();
      if (!disposed) setFailed(true);
    };

    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      resize();

      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
      } else {
        window.addEventListener('resize', resize);
      }

      if (typeof IntersectionObserver === 'function') {
        visibilityObserver = new IntersectionObserver(([entry]) => {
          isIntersecting = entry.isIntersecting;
          updateRenderLoop();
        });
        visibilityObserver.observe(container);
      }

      document.addEventListener('visibilitychange', updateRenderLoop);
      canvas.addEventListener('webglcontextlost', handleContextLost);
      updateRenderLoop();

      new GLTFLoader().load(
        '/scene.glb',
        (gltf) => {
          if (disposed) {
            disposeModel(gltf.scene);
            return;
          }

          model = gltf.scene;
          model.position.set(0, -0.5, 0);
          model.scale.setScalar(0);
          scene.add(model);

          if (gltf.animations.length > 0) {
            mixer = new AnimationMixer(model);
            mixer.clipAction(gltf.animations[0], model).play();
          }

          entranceTween = gsap.to(model.scale, {
            x: 300,
            y: 300,
            z: 300,
            duration: 1.5,
            ease: 'power2.out',
          });

          updateRenderLoop();
          onLoad?.();
        },
        undefined,
        () => {
          if (!disposed) setFailed(true);
        }
      );
    } catch {
      setFailed(true);
    }

    return () => {
      disposed = true;
      isRunning = false;
      window.cancelAnimationFrame(animationFrame);
      entranceTween?.kill();
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', updateRenderLoop);
      canvas.removeEventListener('webglcontextlost', handleContextLost);

      if (mixer && model) {
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
      }

      if (model) {
        scene.remove(model);
        disposeModel(model);
      }

      renderer?.dispose();
    };
  }, [failed, onLoad]);

  if (failed) return <SceneFallback />;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full transition-all duration-300 ${
        isActive ? 'scale-110' : 'scale-100'
      }`}
    >
      <canvas ref={canvasRef} className='w-full h-full' aria-hidden='true' />
    </div>
  );
};

Scene.propTypes = {
  onLoad: PropTypes.func,
  isActive: PropTypes.bool,
};

export default Scene;
