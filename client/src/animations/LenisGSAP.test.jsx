import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LenisGSAP } from './LenisGSAP';

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  prefersReducedMotion: false,
  remove: vi.fn(),
}));

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    ticker: {
      add: mocks.add,
      remove: mocks.remove,
    },
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {},
}));

vi.mock('lenis/react', () => ({
  ReactLenis: ({ children }) => (
    <div data-testid='lenis-root'>{children}</div>
  ),
}));

vi.mock('./useTextRevealAnimation', () => ({
  default: vi.fn(),
}));

vi.mock('../hooks/usePrefersReducedMotion', () => ({
  default: () => mocks.prefersReducedMotion,
}));

afterEach(() => {
  mocks.add.mockClear();
  mocks.remove.mockClear();
  mocks.prefersReducedMotion = false;
});

describe('LenisGSAP', () => {
  it('does not mount smooth scrolling or a ticker for reduced motion', () => {
    mocks.prefersReducedMotion = true;

    render(
      <LenisGSAP>
        <span>Portfolio</span>
      </LenisGSAP>
    );

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.queryByTestId('lenis-root')).not.toBeInTheDocument();
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it('removes its GSAP ticker callback when smooth scrolling unmounts', () => {
    const { unmount } = render(
      <LenisGSAP>
        <span>Portfolio</span>
      </LenisGSAP>
    );

    expect(screen.getByTestId('lenis-root')).toBeInTheDocument();
    expect(mocks.add).toHaveBeenCalledOnce();
    const tickerCallback = mocks.add.mock.calls[0][0];

    unmount();

    expect(mocks.remove).toHaveBeenCalledWith(tickerCallback);
  });
});
