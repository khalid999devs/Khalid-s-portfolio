import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminBar from '../../../components/Navs/Admin/AdminBar';
import AdminNav from '../../../components/Navs/Admin/AdminNav';
import axios from 'axios';
import { reqs } from '../../../axios/requests';

const Admin = () => {
  const navigate = useNavigate();
  const [pageTitle, setPageTitle] = useState('Dashboard');

  useEffect(() => {
    axios
      .get(reqs.IS_ADMIN_VALID, {
        withCredentials: true,
      })
      .then((res) => {
        if (!res.data.succeed) navigate('/admin-login');
      })
      .catch(() => {
        navigate('/admin-login');
      });
    // navigate is stable from useNavigate, pageTitle shouldn't trigger auth check
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTitle]);

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
