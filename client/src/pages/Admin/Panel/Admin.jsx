import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminBar from '../../../components/Navs/Admin/AdminBar';
import AdminNav from '../../../components/Navs/Admin/AdminNav';
import axios from 'axios';
import { reqs } from '../../../axios/requests';

const Admin = () => {
  const navigate = useNavigate();
  const [pageTitle, setPageTitle] = useState('Dashboard');
  /**
   * The search box lives in the top bar but the results belong to whichever
   * page is mounted, so the term is held here and handed to both.
   *
   * It was previously rendered as `<Searchinput />` with no props at all, so
   * typing in it did nothing whatsoever.
   */
  const [searchTerm, setSearchTerm] = useState('');

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
      <AdminBar
        title={pageTitle}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
      />
      <div className='mt-7 sec-x-padding screen-max-width flex gap-x-10 h-full w-full'>
        <div className='max-w-[185px] w-full min-h-[400px]'>
          <AdminNav />
        </div>

        <div className='w-full min-h-[400px]'>
          {/*
            `searchTerm` is passed down rather than each page owning its own
            box, so the one in the top bar filters whatever is on screen.
            Pages that have nothing to search simply ignore it.
          */}
          <Outlet context={{ setPageTitle, searchTerm, setSearchTerm }} />
        </div>
      </div>
    </div>
  );
};

export default Admin;
