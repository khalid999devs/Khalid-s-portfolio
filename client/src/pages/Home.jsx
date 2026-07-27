/* eslint-disable react-refresh/only-export-components */
import Hero from '../components/Home/Hero';
import About from '../components/Home/About';
import ProjectsShows from '../components/Home/Projects';
import HRLine from '../components/utils/HRLine';
import ProjectBanner from '../components/Home/ProjectBanner';
import PageTransition from '../animations/PageTransition';
import MetaCard from '../components/utils/MetaCard';

const Home = () => {
  return (
    <div className='w-full pb-16'>
      {/* Every route owns its metadata -- see the note in App.jsx. */}
      <MetaCard />
      <Hero />
      <HRLine />
      <About />
      <HRLine />
      <ProjectBanner />
      <HRLine />
      <ProjectsShows />
    </div>
  );
};

export default PageTransition(Home);
