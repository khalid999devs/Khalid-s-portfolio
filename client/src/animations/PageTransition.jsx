import { motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';

// Function to calculate random block delay
const calculateRandomBlockDelay = (rowIndex, totalRows) => {
  const blockDelay = Math.random() * 0.4;
  const rowDelay = (totalRows - rowIndex - 1) * 0.05;
  return blockDelay + rowDelay;
};

const PageTransition = (Page) => {
  return function WrappedPage(props) {
    // const [transitionComplete, setTransitionComplete] = useState(false);

    // // Handle transition complete to show page content
    // useEffect(() => {
    //   const timer = setTimeout(() => {
    //     setTransitionComplete(true); // Show content after transition
    //   }, 100); // Duration of the transition (adjust as needed)

    //   return () => clearTimeout(timer); // Cleanup on component unmount
    // }, []);

    return (
      <>
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

        {/* New page content only appears after transition */}
        {/* {transitionComplete && <Page {...props} />}
         */}
        <Page {...props} />

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
