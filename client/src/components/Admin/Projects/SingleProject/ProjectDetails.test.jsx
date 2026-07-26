import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectDetails from './ProjectDetails';

const axiosMocks = vi.hoisted(() => ({
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock('axios', () => ({
  default: axiosMocks,
}));

vi.mock('../../../../axios/projects', () => ({
  deleteProject: vi.fn(),
}));

vi.mock('../../../utils/Popup', () => ({
  default: ({ setPopup, state, text }) =>
    state ? (
      <div data-testid='popup'>
        <span>{text}</span>
        <button
          type='button'
          onClick={() =>
            setPopup((current) => ({ ...current, state: false }))
          }
        >
          Dismiss notice
        </button>
      </div>
    ) : null,
}));

vi.mock('./ProgressAndDel', () => ({
  default: ({ disabled }) => (
    <button type='button' disabled={disabled}>
      Delete project
    </button>
  ),
}));

vi.mock('./ProjectTitles', () => ({
  default: ({ disabled, projectData }) => (
    <label>
      Project title
      <input
        aria-label='Project title'
        disabled={disabled}
        readOnly
        value={projectData.title || ''}
      />
    </label>
  ),
}));

vi.mock('../ProjectContents/LinksAndTechs', () => ({
  default: () => null,
}));
vi.mock('../ProjectContents/Banner', () => ({ default: () => null }));
vi.mock('../ProjectContents/Videos', () => ({ default: () => null }));
vi.mock('../ProjectContents/Thumbnails', () => ({ default: () => null }));
vi.mock('../ProjectContents/SliderContents', () => ({
  default: () => null,
}));

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const loadedProject = {
  id: 17,
  title: 'Loaded safely',
  subtitle: '',
  overview: '',
  role: [],
  category: '',
  date: '',
  locationYear: '',
  videos: [],
  thumbnailContents: [],
  sliderContents: [],
  bannerImg: null,
  techStack: [],
  siteLink: '',
  codeLink: '',
};

const renderEditor = () =>
  render(
    <MemoryRouter>
      <ProjectDetails mode='edit' projectId={17} />
    </MemoryRouter>
  );

beforeEach(() => {
  axiosMocks.patch.mockReset();
  axiosMocks.post.mockReset();
});

describe('ProjectDetails edit loading safety', () => {
  it('keeps the editor unavailable until the requested project is loaded', async () => {
    const projectRequest = createDeferred();
    axiosMocks.post.mockImplementation((_url, body) =>
      body.mode === 'cat'
        ? Promise.resolve({ data: { result: [], succeed: true } })
        : projectRequest.promise
    );

    renderEditor();

    expect(screen.getByRole('status')).toHaveTextContent('Loading project');
    expect(screen.queryByLabelText('Project title')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete project' })
    ).toBeDisabled();

    await act(async () => {
      projectRequest.resolve({
        data: { result: loadedProject, succeed: true },
      });
    });

    expect(await screen.findByLabelText('Project title')).toHaveValue(
      'Loaded safely'
    );
    expect(
      screen.getByRole('button', { name: 'Delete project' })
    ).toBeEnabled();
  });

  it('keeps the editor unavailable after failure and safely retries the load', async () => {
    const retryRequest = createDeferred();
    let projectAttempts = 0;
    axiosMocks.post.mockImplementation((_url, body) => {
      if (body.mode === 'cat') {
        return Promise.resolve({ data: { result: [], succeed: true } });
      }

      projectAttempts += 1;
      return projectAttempts === 1
        ? Promise.reject({
            response: { data: { msg: 'Project service unavailable' } },
          })
        : retryRequest.promise;
    });

    renderEditor();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Project data could not be loaded'
    );
    expect(screen.queryByLabelText('Project title')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete project' })
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Loading project')
    );
    expect(screen.queryByLabelText('Project title')).not.toBeInTheDocument();

    await act(async () => {
      retryRequest.resolve({
        data: { result: loadedProject, succeed: true },
      });
    });

    expect(await screen.findByLabelText('Project title')).toHaveValue(
      'Loaded safely'
    );
    expect(projectAttempts).toBe(2);
  });
});
