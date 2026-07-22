import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ErrorPage from './ErrorPage';

const renderErrorPage = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/error', state }]}>
      <Routes>
        <Route path='/error' element={<ErrorPage />} />
      </Routes>
    </MemoryRouter>
  );

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
});
