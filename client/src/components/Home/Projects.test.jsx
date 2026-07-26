import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectsShows from './Projects';

const runtime = vi.hoisted(() => ({
  desktop: true,
  projects: [
    {
      id: 1,
      title: 'First',
      subtitle: 'First subtitle',
      date: '2024',
      role: ['Development'],
      value: 'first',
      thumbnailContents: [{ url: '/uploads/first.webp' }],
    },
    {
      id: 2,
      title: 'Second',
      subtitle: 'Second subtitle',
      date: '2025',
      role: ['Design'],
      value: 'second',
      thumbnailContents: [{ url: '/uploads/second.webp' }],
    },
    {
      id: 3,
      title: 'Third',
      subtitle: 'Third subtitle',
      date: '2026',
      role: ['Development'],
      value: 'third',
      thumbnailContents: [{ url: '/uploads/third.webp' }],
    },
  ],
  reducedMotion: false,
  scrollConfig: null,
  scrollKill: vi.fn(),
}));
const allProjects = runtime.projects;

vi.mock('../../App', () => ({
  useAppContext: () => ({ appData: { projects: runtime.projects } }),
}));

vi.mock('../../hooks/useIsGreaterOrEqualMd', () => ({
  default: () => runtime.desktop,
}));

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  default: () => runtime.reducedMotion,
}));

vi.mock('gsap', () => ({
  default: {
    delayedCall: (_delay, callback) => {
      callback();
      return { kill: vi.fn() };
    },
    fromTo: vi.fn(),
    killTweensOf: vi.fn(),
    quickSetter: (element, property) =>
      vi.fn((value) => {
        element.style[property] = value;
      }),
    to: vi.fn(),
    utils: {
      toArray: (selector, scope) => [
        ...scope.querySelectorAll(selector),
      ],
    },
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: vi.fn((config) => {
      runtime.scrollConfig = config;
      return { kill: runtime.scrollKill };
    }),
  },
}));

beforeEach(() => {
  runtime.desktop = true;
  runtime.projects = allProjects;
  runtime.reducedMotion = false;
  runtime.scrollConfig = null;
  runtime.scrollKill.mockClear();
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 800,
  });
});

describe('Home project scroll experience', () => {
  it('uses a resize-aware bounded pin distance and exposes only the active slide', () => {
    const { container, unmount } = render(
      <MemoryRouter>
        <ProjectsShows />
      </MemoryRouter>
    );

    const slides = container.querySelectorAll('[data-project-slide]');
    expect(slides).toHaveLength(3);
    expect(runtime.scrollConfig.invalidateOnRefresh).toBe(true);
    expect(runtime.scrollConfig.end()).toBe('+=4800');
    expect(slides[0]).not.toHaveAttribute('aria-hidden');
    expect(slides[0].querySelector('a')).toHaveAttribute('tabindex', '0');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[1].querySelector('a')).toHaveAttribute('tabindex', '-1');

    act(() => {
      runtime.scrollConfig.onUpdate({ direction: 1, progress: 0.35 });
    });

    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[0].querySelector('a')).toHaveAttribute('tabindex', '-1');
    expect(slides[1]).not.toHaveAttribute('aria-hidden');
    expect(slides[1].querySelector('a')).toHaveAttribute('tabindex', '0');

    unmount();
    expect(runtime.scrollKill).toHaveBeenCalledOnce();
  });

  it('renders the lightweight card grid without a scroll trigger for reduced motion', () => {
    runtime.reducedMotion = true;

    const { container } = render(
      <MemoryRouter>
        <ProjectsShows />
      </MemoryRouter>
    );

    expect(runtime.scrollConfig).toBeNull();
    expect(container.querySelectorAll('[data-project-slide]')).toHaveLength(0);
    expect(
      container.querySelectorAll('a[href^="/singleProject/"]')
    ).toHaveLength(3);
  });

  it('does not pin the page when there is only one project to show', () => {
    runtime.projects = [allProjects[0]];

    const { container } = render(
      <MemoryRouter>
        <ProjectsShows />
      </MemoryRouter>
    );

    expect(runtime.scrollConfig).toBeNull();
    expect(
      container.querySelectorAll('a[href^="/singleProject/"]')
    ).toHaveLength(1);
  });
});
