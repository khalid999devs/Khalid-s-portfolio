import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeDownloadButton from './ResumeDownloadButton';
import { downloadResume } from '../../axios/settings';

vi.mock('../../axios/settings', () => ({
  downloadResume: vi.fn(),
}));

describe('ResumeDownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports download errors without a blocking browser dialog', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    downloadResume.mockRejectedValue(new Error('Resume is unavailable.'));
    render(<ResumeDownloadButton />);

    fireEvent.click(screen.getByRole('button', { name: 'DOWNLOAD CV' }));

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent('Resume is unavailable.');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('prevents duplicate requests while a download is pending', async () => {
    let finishDownload;
    downloadResume.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishDownload = resolve;
        })
    );
    render(<ResumeDownloadButton size='small' />);

    fireEvent.click(screen.getByRole('button', { name: 'My Resume' }));
    const pendingButton = screen.getByRole('button', {
      name: 'DOWNLOADING…',
    });
    fireEvent.click(pendingButton);

    expect(downloadResume).toHaveBeenCalledOnce();
    expect(pendingButton).toBeDisabled();

    finishDownload(true);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'My Resume' })
      ).toBeEnabled()
    );
  });
});
