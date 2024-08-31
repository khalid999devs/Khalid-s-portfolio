import React, { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

const Dashboard = () => {
  const { setPageTitle } = useOutletContext();
  useEffect(() => {
    setPageTitle('Dashboard');
  });
  return (
    <div className='pb-20 w-full grid grid-cols-6 gap-5'>
      <div className='col-span-2 box-big-shadow bg-primary-dark rounded-xl min-h-[225px]'></div>
      <div className='col-span-2 box-big-shadow bg-primary-dark rounded-xl min-h-[225px]'></div>
      <div className='col-span-2 box-big-shadow bg-primary-dark rounded-xl min-h-[225px]'></div>
      <div className='col-span-4 box-big-shadow bg-primary-dark rounded-xl min-h-[225px]'></div>
      <div className='col-span-2 box-big-shadow bg-primary-dark rounded-xl min-h-[225px]'></div>
    </div>
  );
};

export default Dashboard;
