import React, { useEffect, useRef } from 'react';
import useWindowSize from '../hooks/useWindowSize';

const MouseMoveEffect = () => {
  const blocksContainerRef = useRef(null);
  const isSizeChanged = useWindowSize();

  useEffect(() => {
    const blocksContainer = blocksContainerRef.current;
    if (!blocksContainer) return;

    const blockSize = 50;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const numCols = Math.ceil(screenWidth / blockSize);
    const numRows = Math.ceil(screenHeight / blockSize);
    const numBlocks = numCols * numRows;

    const blockElements = [];

    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function highlightRandomNeighbors(event) {
      const index = parseInt(event.target.dataset.index);
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
      event.target.classList.add('highlight');
      setTimeout(() => {
        event.target.classList.remove('highlight');
      }, 500);

      shuffleArray(neighbors)
        .slice(0, 1)
        .forEach((nIndex) => {
          const neighbor = blocksContainer.children[nIndex];
          if (neighbor) {
            neighbor.classList.add('highlight');
            setTimeout(() => {
              neighbor.classList.remove('highlight');
            }, 500);
          }
        });
    }

    function createBlocks() {
      for (let i = 0; i < numBlocks; i++) {
        const block = document.createElement('div');
        block.classList.add('block');
        block.dataset.index = i;
        block.addEventListener('mousemove', highlightRandomNeighbors);
        blocksContainer.appendChild(block);
        blockElements.push(block);
      }
    }

    createBlocks();

    return () => {
      blockElements.forEach((block) => {
        block.removeEventListener('mousemove', highlightRandomNeighbors);
      });
      blocksContainer.innerHTML = '';
    };
  }, [isSizeChanged]);

  return (
    <div className='blocks-container fixed top-0 left-0 w-[100vw] h-screen overflow-hidden'>
      <div
        ref={blocksContainerRef}
        id='blocks'
        className='bg-body-main w-[105vw] h-screen flex flex-wrap justify-start content-start overflow-hidden z-50 fixed'
      ></div>
    </div>
  );
};

export default MouseMoveEffect;
