export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

const SLOW_EFFECTIVE_TYPES = new Set(['slow-2g', '2g', '3g']);

export const getNetworkConnection = (navigatorObject) =>
  navigatorObject?.connection ||
  navigatorObject?.mozConnection ||
  navigatorObject?.webkitConnection ||
  null;

export const evaluateSceneCapability = ({
  effectiveType = '',
  isDesktop,
  prefersReducedMotion,
  saveData = false,
  supportsFinePointer,
  supportsWebGL,
}) => {
  if (!isDesktop) {
    return { eligible: false, reason: 'viewport' };
  }
  if (prefersReducedMotion) {
    return { eligible: false, reason: 'reduced-motion' };
  }
  if (!supportsFinePointer) {
    return { eligible: false, reason: 'pointer' };
  }
  if (saveData) {
    return { eligible: false, reason: 'save-data' };
  }
  if (SLOW_EFFECTIVE_TYPES.has(String(effectiveType).toLowerCase())) {
    return { eligible: false, reason: 'slow-connection' };
  }
  if (!supportsWebGL) {
    return { eligible: false, reason: 'webgl' };
  }

  return { eligible: true, reason: null };
};

export const detectWebGLSupport = (documentObject) => {
  if (!documentObject?.createElement) return false;

  try {
    const canvas = documentObject.createElement('canvas');
    const contextOptions = { failIfMajorPerformanceCaveat: true };
    const context =
      canvas.getContext('webgl2', contextOptions) ||
      canvas.getContext('webgl', contextOptions) ||
      canvas.getContext('experimental-webgl', contextOptions);

    if (!context) return false;

    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
};
