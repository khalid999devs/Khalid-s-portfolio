import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Scene from './Scene';

const runtime = vi.hoisted(() => ({
  cancelAnimationFrame: vi.fn(),
  intersectionCallback: null,
  intersectionOptions: null,
  requestAnimationFrame: vi.fn(() => 41),
}));

vi.mock('gsap', () => ({
  default: {
    to: vi.fn(() => ({ kill: vi.fn() })),
  },
}));

vi.mock('three', () => {
  class Positionable {
    position = { set: vi.fn() };
  }

  return {
    ACESFilmicToneMapping: 'aces',
    AmbientLight: class {},
    AnimationMixer: class {
      clipAction = vi.fn(() => ({ play: vi.fn() }));
      stopAllAction = vi.fn();
      uncacheRoot = vi.fn();
      update = vi.fn();
    },
    DirectionalLight: class extends Positionable {},
    PerspectiveCamera: class extends Positionable {
      updateProjectionMatrix = vi.fn();
    },
    Scene: class {
      add = vi.fn();
      remove = vi.fn();
    },
    SRGBColorSpace: 'srgb',
    WebGLRenderer: class {
      dispose = vi.fn();
      forceContextLoss = vi.fn();
      render = vi.fn();
      setPixelRatio = vi.fn();
      setSize = vi.fn();
    },
  };
});

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load(_url, onLoad) {
      onLoad({
        animations: [],
        scene: {
          position: { set: vi.fn() },
          scale: { setScalar: vi.fn() },
          traverse: vi.fn(),
        },
      });
    }
  },
}));

class IntersectionObserverMock {
  constructor(callback, options) {
    runtime.intersectionCallback = callback;
    runtime.intersectionOptions = options;
  }

  disconnect = vi.fn();
  observe = vi.fn();
}

beforeEach(() => {
  runtime.cancelAnimationFrame.mockClear();
  runtime.requestAnimationFrame.mockClear();
  runtime.intersectionCallback = null;
  runtime.intersectionOptions = null;
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    runtime.requestAnimationFrame
  );
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(
    runtime.cancelAnimationFrame
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Scene visibility lifecycle', () => {
  it('starts only after meaningful intersection and pauses when offscreen', () => {
    const onLoad = vi.fn();
    render(<Scene onLoad={onLoad} />);

    expect(onLoad).toHaveBeenCalledOnce();
    expect(runtime.intersectionOptions).toEqual({ threshold: [0, 0.05] });
    expect(runtime.requestAnimationFrame).not.toHaveBeenCalled();

    act(() => {
      runtime.intersectionCallback([
        { intersectionRatio: 0.5, isIntersecting: true },
      ]);
    });
    expect(runtime.requestAnimationFrame).toHaveBeenCalledOnce();

    act(() => {
      runtime.intersectionCallback([
        { intersectionRatio: 0, isIntersecting: false },
      ]);
    });
    expect(runtime.cancelAnimationFrame).toHaveBeenCalledWith(41);
  });
});
