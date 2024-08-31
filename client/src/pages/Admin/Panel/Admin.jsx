import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminBar from '../../../components/Navs/Admin/AdminBar';
import AdminNav from '../../../components/Navs/Admin/AdminNav';

const Admin = () => {
  const [pageTitle, setPageTitle] = useState('Dashboard');
  return (
    <div className='bg-body-main min-h-screen w-full'>
      <AdminBar title={pageTitle} />
      <div className='mt-7 sec-x-padding screen-max-width flex gap-x-10 h-full w-full'>
        <div className='max-w-[185px] w-full min-h-[400px]'>
          <AdminNav />
        </div>

        <div className='w-full min-h-[400px]'>
          <Outlet context={{ setPageTitle }} />
        </div>
      </div>
    </div>
  );
};

export default Admin;
