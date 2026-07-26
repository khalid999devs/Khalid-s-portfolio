import { useEffect, useState } from 'react';
import {
  detectWebGLSupport,
  evaluateSceneCapability,
  FINE_POINTER_QUERY,
  getNetworkConnection,
} from '../utils/sceneCapability';

const initialCapability = { eligible: false, reason: 'checking' };

const useSceneCapability = ({ isDesktop, prefersReducedMotion }) => {
  const [capability, setCapability] = useState(initialCapability);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      setCapability(initialCapability);
      return undefined;
    }

    const pointerQuery = window.matchMedia?.(FINE_POINTER_QUERY);
    const connection = getNetworkConnection(navigator);

    const updateCapability = () => {
      const commonSignals = {
        effectiveType: connection?.effectiveType,
        isDesktop,
        prefersReducedMotion,
        saveData: connection?.saveData === true,
        supportsFinePointer: pointerQuery?.matches === true,
      };
      const withoutWebGL = evaluateSceneCapability({
        ...commonSignals,
        supportsWebGL: true,
      });

      setCapability(
        withoutWebGL.eligible
          ? evaluateSceneCapability({
              ...commonSignals,
              supportsWebGL: detectWebGLSupport(document),
            })
          : withoutWebGL
      );
    };

    updateCapability();
    pointerQuery?.addEventListener?.('change', updateCapability);
    connection?.addEventListener?.('change', updateCapability);

    return () => {
      pointerQuery?.removeEventListener?.('change', updateCapability);
      connection?.removeEventListener?.('change', updateCapability);
    };
  }, [isDesktop, prefersReducedMotion]);

  return capability;
};

export default useSceneCapability;
