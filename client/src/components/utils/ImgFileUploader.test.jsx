import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImgFileUploader from './ImgFileUploader';

const createImage = (name) =>
  new File(['image contents'], name, { type: 'image/png' });

const dropFiles = (target, files) => {
  fireEvent.drop(target, {
    dataTransfer: {
      files,
      items: files.map((file) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
      types: ['Files'],
    },
  });
};

describe('ImgFileUploader cumulative capacity', () => {
  it('accepts only the remaining slot and disables later uploads at capacity', async () => {
    const onLoad = vi.fn();
    const { rerender } = render(
      <ImgFileUploader
        currentFileCount={7}
        maxFiles={8}
        onLoad={onLoad}
      />
    );

    dropFiles(
      screen.getByRole('button', { name: 'Upload image files' }),
      [createImage('eighth.png')]
    );

    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());

    rerender(
      <ImgFileUploader
        currentFileCount={8}
        maxFiles={8}
        onLoad={onLoad}
      />
    );

    const uploader = screen.getByRole('button', {
      name: 'Upload image files',
    });
    expect(uploader).toHaveClass('cursor-not-allowed');

    dropFiles(uploader, [createImage('over-capacity.png')]);

    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
  });

  it('processes only the remaining slot when a selection exceeds capacity', async () => {
    const onLoad = vi.fn();
    render(
      <ImgFileUploader
        currentFileCount={7}
        maxFiles={8}
        onLoad={onLoad}
      />
    );

    dropFiles(
      screen.getByRole('button', { name: 'Upload image files' }),
      [createImage('one.png'), createImage('two.png')]
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /select 1 more image/i
    );
    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    expect(onLoad).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'one.png' })
    );
  });
});
