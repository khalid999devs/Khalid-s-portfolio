import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectVideos from './ProjectVideos';

const runtime = vi.hoisted(() => ({
  intersectionCallback: null,
  intersectionOptions: null,
  prefersReducedMotion: false,
  scrollTriggerCreate: vi.fn(),
}));

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: runtime.scrollTriggerCreate,
  },
}));

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  default: () => runtime.prefersReducedMotion,
}));

class IntersectionObserverMock {
  constructor(callback, options) {
    runtime.intersectionCallback = callback;
    runtime.intersectionOptions = options;
  }

  disconnect = vi.fn();
  observe = vi.fn();
}

const setConnection = (saveData = false) => {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      saveData,
    },
  });
};

const revealVideo = () => {
  act(() => {
    runtime.intersectionCallback([{ isIntersecting: true }]);
  });
};

beforeEach(() => {
  runtime.intersectionCallback = null;
  runtime.intersectionOptions = null;
  runtime.prefersReducedMotion = false;
  runtime.scrollTriggerCreate.mockReset();
  runtime.scrollTriggerCreate.mockReturnValue({ kill: vi.fn() });
  setConnection(false);
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ProjectVideos progressive loading', () => {
  it('withholds the source until the video is near the viewport', () => {
    render(
      <ProjectVideos
        videos={[{ id: 'demo', url: '/uploads/demo.mp4' }]}
      />
    );

    const video = screen.getByLabelText('Project video 1');
    expect(video).not.toHaveAttribute('src');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).toHaveAttribute('controls');
    expect(runtime.intersectionOptions).toEqual({
      rootMargin: '600px 0px',
      threshold: 0,
    });

    revealVideo();

    expect(video).toHaveAttribute(
      'src',
      'http://localhost:8000/uploads/demo.mp4'
    );
    expect(runtime.scrollTriggerCreate).toHaveBeenCalledOnce();
  });

  it.each([
    ['Save-Data', true, false],
    ['reduced motion', false, true],
  ])(
    'keeps manual controls but suppresses autoplay for %s',
    (_preference, saveData, prefersReducedMotion) => {
      setConnection(saveData);
      runtime.prefersReducedMotion = prefersReducedMotion;

      render(
        <ProjectVideos
          videos={[{ id: 'demo', url: '/uploads/demo.mp4' }]}
        />
      );
      revealVideo();

      expect(screen.getByLabelText('Project video 1')).toHaveAttribute(
        'controls'
      );
      expect(runtime.scrollTriggerCreate).not.toHaveBeenCalled();
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    }
  );
});
