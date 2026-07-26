import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProjectDeleteDialog from './ProjectDeleteDialog';

const project = { id: 7, name: 'Exact Project Name' };

const DialogHarness = ({ onConfirm = vi.fn() }) => {
  const [target, setTarget] = useState(null);

  return (
    <>
      <button type='button' onClick={() => setTarget(project)}>
        Open delete confirmation
      </button>
      <ProjectDeleteDialog
        onCancel={() => setTarget(null)}
        onConfirm={onConfirm}
        project={target}
      />
    </>
  );
};

describe('ProjectDeleteDialog', () => {
  it('requires an exact typed project name before confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} />);

    await user.click(
      screen.getByRole('button', { name: 'Open delete confirmation' })
    );

    const input = screen.getByRole('textbox', { name: 'Project name' });
    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    expect(input).toHaveFocus();
    expect(confirmButton).toBeDisabled();

    await user.type(input, 'Wrong name');
    expect(
      screen.getByText('The project name must match exactly.')
    ).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, project.name);
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith(project);
  });

  it('closes without confirming and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} />);

    const trigger = screen.getByRole('button', {
      name: 'Open delete confirmation',
    });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('dialog', { name: 'Delete project?' })
    ).not.toBeInTheDocument();
  });
});
