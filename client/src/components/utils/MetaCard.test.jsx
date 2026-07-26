import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MetaCard from './MetaCard';

const MANAGED_SELECTOR = [
  'link[rel="canonical"]',
  'meta[name]',
  'meta[property]',
  'script[data-schema]',
].join(',');

const resetHead = () => {
  document.head
    .querySelectorAll(MANAGED_SELECTOR)
    .forEach((element) => element.remove());
  document.title = '';
};

beforeEach(resetHead);
afterEach(resetHead);

const countOf = (selector) => document.head.querySelectorAll(selector).length;

describe('MetaCard', () => {
  it('publishes a query-free canonical URL and normalized metadata', async () => {
    window.history.replaceState({}, '', '/projects?token=secret#work');

    render(
      <MetaCard
        title='  Selected   work  '
        description={'A   focused\nportfolio.'}
        image='/uploads/project.webp'
      />
    );

    await waitFor(() => {
      expect(document.title).toBe('Selected work | Khalid Ahammed');
    });

    expect(document.head.querySelector('link[rel="canonical"]')?.href).toBe(
      'https://khalidahammed.com/projects'
    );
    expect(
      document.head.querySelector('meta[name="description"]')?.content
    ).toBe('A focused portfolio.');
    expect(
      document.head.querySelector('meta[property="og:image"]')?.content
    ).toBe('https://khalidahammed.com/uploads/project.webp');
  });

  it('rejects credential-bearing or active-content preview URLs', async () => {
    render(<MetaCard image='javascript:alert(1)' title='Project' />);

    await waitFor(() => {
      expect(document.title).toBe('Project | Khalid Ahammed');
    });

    expect(
      document.head.querySelector('meta[property="og:image"]')?.content
    ).toBe('https://khalidahammed.com/og-banner.jpg');
  });

  it('never emits a duplicate title, canonical, or description', async () => {
    // Two sequential renders emulate a client-side route change. Appending
    // instead of upserting would leave the page advertising conflicting
    // canonicals, which search engines resolve by discarding all of them.
    window.history.replaceState({}, '', '/projects');
    const { rerender } = render(<MetaCard title='Projects' />);

    await waitFor(() => {
      expect(document.title).toBe('Projects | Khalid Ahammed');
    });

    window.history.replaceState({}, '', '/about-me');
    rerender(<MetaCard title='About Myself' />);

    await waitFor(() => {
      expect(document.title).toBe('About Myself | Khalid Ahammed');
    });

    expect(countOf('link[rel="canonical"]')).toBe(1);
    expect(countOf('meta[name="description"]')).toBe(1);
    expect(countOf('meta[property="og:title"]')).toBe(1);
    expect(countOf('meta[name="twitter:card"]')).toBe(1);
    expect(document.querySelectorAll('title').length).toBeLessThanOrEqual(1);
  });

  it('falls back to the full site title when no page title is supplied', async () => {
    render(<MetaCard />);

    await waitFor(() => {
      expect(document.title).toBe(
        'Khalid Ahammed — Full-Stack Web & Mobile Developer'
      );
    });
  });

  it('withholds indexing and the canonical link on private pages', async () => {
    window.history.replaceState({}, '', '/admin-login');

    render(<MetaCard title='Administrator sign in' noIndex />);

    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')?.content).toBe(
        'noindex, nofollow'
      );
    });

    expect(countOf('link[rel="canonical"]')).toBe(0);
  });

  it('publishes and then withdraws page-level structured data', async () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
    };
    const { rerender } = render(
      <MetaCard title='A project' structuredData={schema} />
    );

    await waitFor(() => {
      expect(countOf('script[data-schema="page-schema"]')).toBe(1);
    });
    expect(
      JSON.parse(
        document.head.querySelector('script[data-schema="page-schema"]')
          .textContent
      )['@type']
    ).toBe('CreativeWork');

    rerender(<MetaCard title='A project' />);

    await waitFor(() => {
      expect(countOf('script[data-schema="page-schema"]')).toBe(0);
    });
  });
});
