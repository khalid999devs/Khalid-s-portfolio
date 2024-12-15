import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/Navs/Navbar';
import Footer from './components/Footer/Footer';

const App = () => {
  return (
    <div className='bg-body-main min-h-screen w-full'>
      <Navbar />
      <div>
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};

export default App;
