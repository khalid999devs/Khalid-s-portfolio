import { useEffect, useRef } from 'react';
import useWindowSize from '../hooks/useWindowSize';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

const MouseMoveEffect = () => {
  const blocksContainerRef = useRef(null);
  const windowSize = useWindowSize();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const blocksContainer = blocksContainerRef.current;
    if (!blocksContainer) return;

    const supportsFinePointer =
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(pointer: fine)').matches;
    if (!supportsFinePointer || prefersReducedMotion) {
      blocksContainer.replaceChildren();
      return undefined;
    }

    const blockSize = 50;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const numCols = Math.ceil(screenWidth / blockSize);
    const numRows = Math.ceil(screenHeight / blockSize);
    const numBlocks = numCols * numRows;

    const blockElements = [];
    const removalTimers = new Map();
    let animationFrameId;
    let pendingIndex = null;

    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function scheduleRemoval(block) {
      const previousTimer = removalTimers.get(block);
      if (previousTimer) window.clearTimeout(previousTimer);

      const timer = window.setTimeout(() => {
        block.classList.remove('cursor-grid-highlight');
        removalTimers.delete(block);
      }, 500);
      removalTimers.set(block, timer);
    }

    function highlightRandomNeighbors(index) {
      if (!Number.isInteger(index) || index < 0 || index >= numBlocks) return;

      const neighbors = [
        index - 1,
        index + 1,
        index - numCols,
        index + numCols,
        index - numCols - 1,
        index - numCols + 1,
        index + numCols - 1,
        index + numCols + 1,
      ].filter(
        (i) =>
          i >= 0 &&
          i < numBlocks &&
          Math.abs((i % numCols) - (index % numCols)) <= 1
      );
      const activeBlock = blockElements[index];
      activeBlock.classList.add('cursor-grid-highlight');
      scheduleRemoval(activeBlock);

      shuffleArray(neighbors)
        .slice(0, 1)
        .forEach((nIndex) => {
          const neighbor = blockElements[nIndex];
          if (neighbor) {
            neighbor.classList.add('cursor-grid-highlight');
            scheduleRemoval(neighbor);
          }
        });
    }

    function handlePointerMove(event) {
      const col = Math.floor(event.clientX / blockSize);
      const row = Math.floor(event.clientY / blockSize);
      pendingIndex = row * numCols + col;

      if (animationFrameId !== undefined) return;
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = undefined;
        highlightRandomNeighbors(pendingIndex);
      });
    }

    function createBlocks() {
      const fragment = document.createDocumentFragment();

      for (let i = 0; i < numBlocks; i++) {
        const block = document.createElement('div');
        block.classList.add('cursor-grid-cell');
        block.dataset.index = i;
        fragment.appendChild(block);
        blockElements.push(block);
      }

      blocksContainer.replaceChildren(fragment);
    }

    createBlocks();
    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.cancelAnimationFrame(animationFrameId);
      removalTimers.forEach((timer) => window.clearTimeout(timer));
      removalTimers.clear();
      blocksContainer.replaceChildren();
    };
  }, [prefersReducedMotion, windowSize]);

  return (
    <div
      aria-hidden='true'
      className='blocks-container pointer-events-none fixed top-0 left-0 w-[100vw] h-screen overflow-hidden'
    >
      <div
        ref={blocksContainerRef}
        id='blocks'
        className='pointer-events-none w-[105vw] h-screen flex flex-wrap justify-start content-start overflow-hidden fixed'
      ></div>
    </div>
  );
};

export default MouseMoveEffect;
