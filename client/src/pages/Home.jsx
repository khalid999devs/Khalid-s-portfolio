import React from 'react';
import Hero from '../components/Home/Hero';
import About from '../components/Home/About';

const Home = () => {
  return (
    <div className='w-full body-max-width sec-inner-x-padding pb-16'>
      <Hero />
      <About />
    </div>
  );
};

export default Home;
