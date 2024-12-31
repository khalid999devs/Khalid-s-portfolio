import React from 'react';
import Hero from '../components/Home/Hero';
import About from '../components/Home/About';
import ProjectsShows from '../components/Home/Projects';
import HRLine from '../components/utils/HRLine';
import ProjectBanner from '../components/Home/ProjectBanner';

const Home = () => {
  return (
    <div className='w-full pb-16'>
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

export default Home;
