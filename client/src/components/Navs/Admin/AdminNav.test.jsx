import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminNav from './AdminNav';

const axiosMock = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('axios', () => ({
  default: axiosMock,
}));

const createDeferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const renderAdminNav = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path='/admin/*' element={<AdminNav />} />
        <Route path='/admin-login' element={<p>Admin sign in</p>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  axiosMock.post.mockReset();
});

describe('AdminNav logout feedback', () => {
  it('renders request failures as accessible inline feedback', async () => {
    const user = userEvent.setup();
    axiosMock.post.mockResolvedValue({
      data: { msg: 'Session service unavailable', succeed: false },
    });
    renderAdminNav();

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Session service unavailable'
    );
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled();
  });

  it('disables duplicate submissions while logging out and navigates on success', async () => {
    const user = userEvent.setup();
    const request = createDeferred();
    axiosMock.post.mockReturnValue(request.promise);
    renderAdminNav();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(
      screen.getByRole('button', { name: 'Logging out…' })
    ).toBeDisabled();

    await act(async () => {
      request.resolve({ data: { succeed: true } });
    });

    expect(await screen.findByText('Admin sign in')).toBeInTheDocument();
    expect(axiosMock.post).toHaveBeenCalledOnce();
  });
});
