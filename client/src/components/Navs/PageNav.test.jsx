import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PageNav from './PageNav';

const animationMocks = vi.hoisted(() => ({
  fromTo: vi.fn(() => ({ kill: vi.fn() })),
  toArray: vi.fn(() => []),
}));
const reducedMotionMock = vi.hoisted(() => vi.fn());

vi.mock('gsap', () => ({
  default: {
    fromTo: animationMocks.fromTo,
    utils: { toArray: animationMocks.toArray },
  },
}));

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  default: reducedMotionMock,
}));

vi.mock('./Admin/NavLogo', () => ({
  default: ({ onClick }) => (
    <button type='button' onClick={onClick}>
      Home logo
    </button>
  ),
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const MotionDiv = React.forwardRef((props, ref) => {
    const domProps = { ...props };
    const children = domProps.children;
    delete domProps.animate;
    delete domProps.children;
    delete domProps.exit;
    delete domProps.initial;
    delete domProps.transition;
    return React.createElement('div', { ...domProps, ref }, children);
  });

  return {
    AnimatePresence: ({ children }) => children,
    motion: { div: MotionDiv },
  };
});

const pageNavView = ({
  isMenuPresent,
  isPageMenu,
  setIsPageMenu,
  triggerRef,
}) => (
  <MemoryRouter>
    <button ref={triggerRef} type='button'>
      Menu trigger
    </button>
    <main data-testid='page-background'>Page content</main>
    <PageNav
      isMenuPresent={isMenuPresent}
      isPageMenu={isPageMenu}
      setIsPageMenu={setIsPageMenu}
      triggerRef={triggerRef}
    />
  </MemoryRouter>
);

beforeEach(() => {
  animationMocks.fromTo.mockClear();
  animationMocks.toArray.mockClear();
  reducedMotionMock.mockReset();
  reducedMotionMock.mockReturnValue(false);
  document.body.style.overflow = '';
});

describe('PageNav accessibility lifecycle', () => {
  it('skips decorative motion when reduced motion is preferred', () => {
    reducedMotionMock.mockReturnValue(true);
    const triggerRef = createRef();

    render(
      pageNavView({
        isMenuPresent: true,
        isPageMenu: true,
        setIsPageMenu: vi.fn(),
        triggerRef,
      })
    );

    expect(screen.getByRole('dialog', { name: 'Site menu' })).toBeVisible();
    expect(document.querySelector('.page-blocks-container')).toBeNull();
    expect(animationMocks.fromTo).not.toHaveBeenCalled();
    expect(animationMocks.toArray).not.toHaveBeenCalled();
  });

  it('keeps the page locked through modal exit and restores it afterward', () => {
    document.body.style.overflow = 'clip';
    const setIsPageMenu = vi.fn();
    const triggerRef = createRef();
    const { rerender } = render(
      pageNavView({
        isMenuPresent: true,
        isPageMenu: true,
        setIsPageMenu,
        triggerRef,
      })
    );
    const background = screen.getByTestId('page-background');
    const trigger = triggerRef.current;

    expect(document.body.style.overflow).toBe('hidden');
    expect(background.inert).toBe(true);
    expect(background).toHaveAttribute('aria-hidden', 'true');
    expect(
      screen.getByRole('button', { name: 'Close site menu' })
    ).toHaveFocus();

    rerender(
      pageNavView({
        isMenuPresent: true,
        isPageMenu: false,
        setIsPageMenu,
        triggerRef,
      })
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(background.inert).toBe(true);
    expect(background).toHaveAttribute('aria-hidden', 'true');
    expect(trigger).not.toHaveFocus();

    rerender(
      pageNavView({
        isMenuPresent: false,
        isPageMenu: false,
        setIsPageMenu,
        triggerRef,
      })
    );

    expect(document.body.style.overflow).toBe('clip');
    expect(background.inert).not.toBe(true);
    expect(background).not.toHaveAttribute('aria-hidden');
    expect(trigger).toHaveFocus();
  });
});
