/* eslint-disable react-refresh/only-export-components */
import { useNavigate } from 'react-router-dom';
import { OutlinedBigIcon } from '../components/Buttons/OutlinedButton';
import SectionLabel from '../components/utils/SectionLabel';
import PageTransition from '../animations/PageTransition';
import MetaCard from '../components/utils/MetaCard';

// Deliberately unlinked: the route exists but nothing navigates to it yet.
// Anyone who reaches it directly should still land on a finished-looking page
// with a way out, not on the word "CodingLab" alone.
const CodingLab = () => {
  const navigate = useNavigate();

  return (
    <div className='w-full pb-28 min-h-screen screen-max-width pt-[160px] sec-x-padding'>
      {/* Every route owns its metadata -- see the note in App.jsx. */}
      <MetaCard
        title={'Coding Lab'}
        description={
          'A place for the experiments and half-built ideas that never make it into a case study. Opening soon.'
        }
      />
      {/* Thin by design, so it is worth nothing in search until it is real.
          React 19 hoists this into <head> the same way MetaCard's tags go. */}
      <meta name='robots' content='noindex' />

      <div className='flex flex-col gap-8 w-full md:pl-28'>
        <SectionLabel text={'Coming soon'} />

        <div className='flex w-full justify-center md:justify-start items-center gap-4'>
          <h1 className='text-[2.2rem] sm:text-[3rem] md:text-[4rem] text-pp-eiko text-letter-reveal'>
            CODING
          </h1>

          <h1 className='text-[2.2rem] sm:text-[3rem] md:text-[4rem] text-letter-reveal'>
            LAB
          </h1>
        </div>

        <p className='max-w-[560px] text-sm sm:text-base text-secondary-light leading-relaxed'>
          A place for the experiments, the half-built ideas and the things I
          take apart to see how they work — the ones that never turn into a case
          study. It is still being put together.
        </p>

        <p className='text-[10px] sm:text-xs text-secondary-light opacity-80 uppercase text-montreal-mono'>
          Meanwhile, the finished work lives here
        </p>

        <div className='flex flex-row flex-wrap gap-3 items-center justify-center md:justify-start'>
          <OutlinedBigIcon
            classes='!border-[0.2px] border-onPrimary-main/50 !rounded-[3px]'
            text='Selected works'
            onClick={() => navigate('/projects')}
          />
          <OutlinedBigIcon
            classes='!border-[0.2px] border-onPrimary-main/50 !rounded-[3px]'
            text='Back home'
            onClick={() => navigate('/')}
          />
        </div>
      </div>
    </div>
  );
};

export default PageTransition(CodingLab);
