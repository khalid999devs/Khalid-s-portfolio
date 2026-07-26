import { describe, expect, it } from 'vitest';
import {
  isValidProjectResponse,
  parseProjectIdFromRoute,
} from './projectResponse';

const validProject = {
  id: 42,
  title: 'Portfolio',
  value: 'portfolio',
  subtitle: 'A personal site',
  overview: 'Project overview',
  role: ['Development'],
  techStack: ['React'],
  videos: [{ id: 'video-1', url: '/uploads/demo.mp4' }],
  thumbnailContents: [],
  sliderContents: [{ id: 'slide-1', url: '/uploads/slide.webp' }],
};

describe('project response validation', () => {
  it('accepts the expected public project response', () => {
    expect(
      isValidProjectResponse(
        { succeed: true, result: validProject },
        validProject.id
      )
    ).toBe(true);
  });

  it('rejects mismatched ids and malformed display collections', () => {
    expect(
      isValidProjectResponse(
        { succeed: true, result: validProject },
        validProject.id + 1
      )
    ).toBe(false);
    expect(
      isValidProjectResponse(
        {
          succeed: true,
          result: { ...validProject, videos: [{ url: null }] },
        },
        validProject.id
      )
    ).toBe(false);
  });

  it('parses only canonical database ids from route values', () => {
    expect(parseProjectIdFromRoute('portfolio@42')).toBe(42);
    expect(parseProjectIdFromRoute('portfolio@0042')).toBeNull();
    expect(parseProjectIdFromRoute('portfolio@42x')).toBeNull();
    expect(parseProjectIdFromRoute('portfolio@2147483648')).toBeNull();
  });
});
