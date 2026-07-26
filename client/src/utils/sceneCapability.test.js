import { describe, expect, it } from 'vitest';
import { evaluateSceneCapability } from './sceneCapability';

const capableSignals = {
  effectiveType: '4g',
  isDesktop: true,
  prefersReducedMotion: false,
  saveData: false,
  supportsFinePointer: true,
  supportsWebGL: true,
};

describe('evaluateSceneCapability', () => {
  it('offers 3D only when every capability gate passes', () => {
    expect(evaluateSceneCapability(capableSignals)).toEqual({
      eligible: true,
      reason: null,
    });
  });

  it.each([
    ['viewport', { isDesktop: false }],
    ['reduced-motion', { prefersReducedMotion: true }],
    ['pointer', { supportsFinePointer: false }],
    ['save-data', { saveData: true }],
    ['slow-connection', { effectiveType: '3g' }],
    ['webgl', { supportsWebGL: false }],
  ])('blocks 3D for %s constraints', (reason, override) => {
    expect(
      evaluateSceneCapability({ ...capableSignals, ...override })
    ).toEqual({
      eligible: false,
      reason,
    });
  });
});
