import { render, screen } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
} from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorPage from './ErrorPage';

const renderErrorPage = (state) => {
  const router = createMemoryRouter(
    [
      {
        path: '/error',
        element: <ErrorPage />,
        errorElement: <ErrorPage />,
      },
    ],
    { initialEntries: [{ pathname: '/error', state }] }
  );

  return render(<RouterProvider router={router} />);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorPage', () => {
  it('renders an actionable service error for a failed project request', () => {
    renderErrorPage({
      errorType: 'service',
      retryPath: '/singleProject/portfolio@4',
    });

    expect(
      screen.getByRole('heading', { name: '503' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Portfolio temporarily unavailable',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try Again' })).toHaveAttribute(
      'href',
      '/singleProject/portfolio@4'
    );
  });

  it('keeps the default error state specific to a missing page', () => {
    renderErrorPage();

    expect(
      screen.getByRole('heading', { name: '404' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Oops! Page not found' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Try Again' })
    ).not.toBeInTheDocument();
  });

  it('distinguishes an unexpected route failure from a missing page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: () => {
            throw new Error('Sensitive internal detail');
          },
          element: <div>Never rendered</div>,
          errorElement: <ErrorPage />,
        },
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { name: '500' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Something went wrong' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Sensitive internal detail')
    ).not.toBeInTheDocument();
  });
});
