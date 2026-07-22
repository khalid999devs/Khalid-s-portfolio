import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LinksAndTechs from './LinksAndTechs';

const project = {
  id: 4,
  siteLink: 'https://old.example.test',
  designLink: '',
  codeLink: 'https://github.com/example/old',
  techStack: ['React'],
};

describe('LinksAndTechs', () => {
  it('preserves an unsaved draft when unrelated project media changes', async () => {
    const user = userEvent.setup();
    const handleSubmitData = vi.fn();
    const { rerender } = render(
      <LinksAndTechs
        mode='edit'
        projectData={project}
        handleSubmitData={handleSubmitData}
      />
    );

    const siteLink = screen.getByLabelText('Live Sitelink');
    await user.clear(siteLink);
    await user.type(siteLink, 'https://draft.example.test');

    rerender(
      <LinksAndTechs
        mode='edit'
        projectData={{
          ...project,
          thumbnailContents: [{ id: 9, url: '/uploads/new.webp' }],
        }}
        handleSubmitData={handleSubmitData}
      />
    );

    expect(screen.getByLabelText('Live Sitelink')).toHaveValue(
      'https://draft.example.test'
    );
  });

  it('initializes a new draft when the project identity changes', () => {
    const { rerender } = render(
      <LinksAndTechs
        mode='edit'
        projectData={project}
        handleSubmitData={vi.fn()}
      />
    );

    rerender(
      <LinksAndTechs
        mode='edit'
        projectData={{
          ...project,
          id: 5,
          siteLink: 'https://next.example.test',
        }}
        handleSubmitData={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Live Sitelink')).toHaveValue(
      'https://next.example.test'
    );
  });
});
