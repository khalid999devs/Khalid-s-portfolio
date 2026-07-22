import { motion } from 'framer-motion';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

const transition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1],
};

const PageTransition = (Page) => {
  const WrappedPage = function (props) {
    const prefersReducedMotion = usePrefersReducedMotion();

    if (prefersReducedMotion) return <Page {...props} />;

    return (
      <>
        <div className='page-blocks-container transition-in'>
          <motion.div
            className='block-motion'
            initial={{ scaleY: 1 }}
            animate={{ scaleY: 0 }}
            exit={{ scaleY: 0 }}
            transition={transition}
          />
        </div>

        <Page {...props} />

        <div className='page-blocks-container transition-out'>
          <motion.div
            className='block-motion'
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 0 }}
            exit={{ scaleY: 1 }}
            transition={transition}
          />
        </div>
      </>
    );
  };

  WrappedPage.displayName = `PageTransition(${
    Page.displayName || Page.name || 'Component'
  })`;
  return WrappedPage;
};

export default PageTransition;
