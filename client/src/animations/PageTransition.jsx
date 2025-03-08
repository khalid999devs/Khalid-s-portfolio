import { motion } from 'framer-motion';
import React from 'react';
//block delay = 0.5
//duration =1

const calculateRandomBlockDelay = (rowIndex, totalRows) => {
  const blockDelay = Math.random() * 0.4;
  const rowDelay = (totalRows - rowIndex - 1) * 0.05;
  return blockDelay + rowDelay;
};

const PageTransition = (Page) => {
  return function WrappedPage(props) {
    return (
      <>
        <Page {...props} />
        <div className='page-blocks-container transition-in'>
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <div className='row' key={rowIndex}>
              {Array.from({ length: 11 }).map((_, blockIndex) => (
                <motion.div
                  key={blockIndex}
                  className='block-motion'
                  initial={{ scaleY: 1 }}
                  animate={{ scaleY: 0 }}
                  exit={{ scaleY: 0 }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: calculateRandomBlockDelay(rowIndex, 10),
                  }}
                ></motion.div>
              ))}
            </div>
          ))}
        </div>

        <div className='page-blocks-container transition-out'>
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <div className='row' key={rowIndex}>
              {Array.from({ length: 11 }).map((_, blockIndex) => (
                <motion.div
                  key={blockIndex}
                  className='block-motion'
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 0 }}
                  exit={{ scaleY: 1 }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: calculateRandomBlockDelay(rowIndex, 10),
                  }}
                ></motion.div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  };
};

export default PageTransition;
