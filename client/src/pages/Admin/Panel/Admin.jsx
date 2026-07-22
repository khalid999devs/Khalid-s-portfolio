import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminBar from '../../../components/Navs/Admin/AdminBar';
import AdminNav from '../../../components/Navs/Admin/AdminNav';
import axios from 'axios';
import { reqs } from '../../../axios/requests';

const Admin = () => {
  const navigate = useNavigate();
  const [pageTitle, setPageTitle] = useState('Dashboard');
  const [authStatus, setAuthStatus] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();

    axios
      .get(reqs.IS_ADMIN_VALID, {
        signal: controller.signal,
      })
      .then((res) => {
        if (res.data.succeed) {
          setAuthStatus('authorized');
        } else {
          navigate('/admin-login', { replace: true });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          navigate('/admin-login', { replace: true });
        }
      });

    return () => controller.abort();
  }, [navigate]);

  if (authStatus !== 'authorized') {
    return (
      <div
        className='bg-body-main min-h-screen w-full flex items-center justify-center text-onPrimary-main'
        role='status'
        aria-live='polite'
      >
        Verifying administrator session…
      </div>
    );
  }

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
