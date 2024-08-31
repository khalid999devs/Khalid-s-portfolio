import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/Navs/Navbar';
import Footer from './components/Footer/Footer';

const App = () => {
  return (
    <div className='bg-body-main min-h-screen w-full'>
      <h1 className='text-4xl text-pp-eiko'>Hello World</h1>
      <Navbar />
      <div>
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};

export default App;
