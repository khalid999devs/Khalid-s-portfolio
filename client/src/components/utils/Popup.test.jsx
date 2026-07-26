import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Popup from './Popup';

vi.mock('gsap', () => ({
  default: {
    killTweensOf: vi.fn(),
    timeline: vi.fn(() => ({
      kill: vi.fn(),
      to(element, options = {}) {
        if (options.display) element.style.display = options.display;
        options.onComplete?.();
        return this;
      },
    })),
  },
}));

describe('Popup', () => {
  it('closes with Escape and restores focus to the invoking control', async () => {
    const user = userEvent.setup();
    const setPopup = vi.fn();
    const { container, rerender } = render(
      <>
        <button type='button'>Open dialog</button>
        <Popup
          text='Saved successfully'
          state={false}
          setPopup={setPopup}
          type='success'
        />
      </>
    );
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();

    rerender(
      <>
        <button type='button'>Open dialog</button>
        <Popup
          text='Saved successfully'
          state
          setPopup={setPopup}
          type='success'
        />
      </>
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    expect(container).toHaveAttribute('aria-hidden', 'true');
    expect(container.inert).toBe(true);
    await user.keyboard('{Escape}');
    expect(setPopup).toHaveBeenCalledOnce();

    rerender(
      <>
        <button type='button'>Open dialog</button>
        <Popup
          text='Saved successfully'
          state={false}
          setPopup={setPopup}
          type='success'
        />
      </>
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body.style.overflow).toBe('');
    expect(container).not.toHaveAttribute('aria-hidden');
    expect(container.inert).not.toBe(true);
  });

  it('keeps forward keyboard focus inside the modal controls', async () => {
    const user = userEvent.setup();
    render(
      <Popup
        text='Confirm the action'
        state
        setPopup={vi.fn()}
        type='warning'
        customButtons={<button type='button'>Cancel</button>}
      />
    );

    const confirm = screen.getByRole('button', { name: 'Ok' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    cancel.focus();

    await user.tab();
    expect(confirm).toHaveFocus();
  });
});
