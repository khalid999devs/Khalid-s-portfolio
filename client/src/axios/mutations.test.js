import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

import axios from 'axios';
import { deleteProject } from './projects';
import { downloadResume } from './settings';

describe('destructive project requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('performs a confirmed delete request and always clears loading', async () => {
    axios.delete.mockResolvedValue({
      data: { succeed: true, msg: 'Project deleted.' },
    });
    const setLoading = vi.fn();

    await expect(
      deleteProject(4, setLoading)
    ).resolves.toMatchObject({ succeed: true });
    expect(axios.delete).toHaveBeenCalledWith('/api/projects/delete/4', {
      withCredentials: true,
    });
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });
});

describe('resume downloads', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('releases the temporary object URL after starting the download', async () => {
    vi.useFakeTimers();
    axios.get.mockResolvedValue({ data: new Uint8Array([1, 2, 3]) });
    const createObjectURL = vi.fn(() => 'blob:resume');
    const revokeObjectURL = vi.fn();
    Object.defineProperties(window.URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await expect(downloadResume()).resolves.toBe(true);
    expect(axios.get).toHaveBeenCalledWith('/api/settings/download-resume', {
      responseType: 'blob',
    });
    expect(createObjectURL).toHaveBeenCalledOnce();

    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:resume');
  });
});
