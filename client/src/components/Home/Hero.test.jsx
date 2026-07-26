import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Hero from './Hero';

const interactionMock = vi.hoisted(() => ({
  handleClick: vi.fn(),
  isActive: false,
  isDesktop: true,
  isLoaded: false,
  prefersReducedMotion: false,
  setIsLoaded: vi.fn(),
}));

vi.mock('../../hooks/useMichibotInteraction', () => ({
  useMichibotInteraction: () => interactionMock,
}));

vi.mock('../../animations/textBlinkAnimation', () => ({
  textBlinkAnimation: () => ({ kill: vi.fn() }),
}));

vi.mock('../../animations/textBlinkAnimateByWord', () => ({
  textBlinkAnimateByWord: () => ({ kill: vi.fn() }),
}));

vi.mock('../../animations/wordBlinkAnimation', () => ({
  wordBlinkAnimation: () => ({ kill: vi.fn() }),
}));

vi.mock('./bot/Scene', () => ({
  default: () => <div data-testid='interactive-scene'>3D scene</div>,
}));

const setConnection = (overrides = {}) => {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      effectiveType: '4g',
      removeEventListener: vi.fn(),
      saveData: false,
      ...overrides,
    },
  });
};

beforeEach(() => {
  Object.assign(interactionMock, {
    handleClick: vi.fn(),
    isActive: false,
    isDesktop: true,
    isLoaded: false,
    prefersReducedMotion: false,
    setIsLoaded: vi.fn(),
  });
  setConnection();

  window.matchMedia = vi.fn(() => ({
    addEventListener: vi.fn(),
    matches: true,
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    getExtension: vi.fn(() => ({ loseContext: vi.fn() })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Hero 3D progressive enhancement', () => {
  it('keeps the heavy scene unloaded until the user explicitly enables it', async () => {
    const user = userEvent.setup();
    const { container } = render(<Hero />);

    expect(
      container.querySelector('img[src="/Images/Hero/robot.png"]')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('interactive-scene')).not.toBeInTheDocument();

    const enableButton = await screen.findByRole('button', {
      name: 'Enable the interactive 3D Michi Bot',
    });
    await user.click(enableButton);

    expect(await screen.findByTestId('interactive-scene')).toBeInTheDocument();
  });

  it('does not offer the heavy scene when Save-Data is enabled', async () => {
    setConnection({ saveData: true });
    render(<Hero />);

    const botButton = await screen.findByRole('button', {
      name: 'Interactive 3D Michi Bot is unavailable on this device',
    });
    expect(botButton).toBeDisabled();
    expect(screen.queryByTestId('interactive-scene')).not.toBeInTheDocument();
  });

  it('does not offer the heavy scene to reduced-motion users', async () => {
    interactionMock.prefersReducedMotion = true;
    render(<Hero />);

    const botButton = await screen.findByRole('button', {
      name: 'Interactive 3D Michi Bot is unavailable on this device',
    });
    expect(botButton).toBeDisabled();
    expect(screen.queryByTestId('interactive-scene')).not.toBeInTheDocument();
  });
});
