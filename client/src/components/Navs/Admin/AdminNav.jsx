import { useState } from 'react';
import { adminNavLinks } from '../../../Constants';
import { NavLink, useNavigate } from 'react-router-dom';
import { MdLogout } from 'react-icons/md';
import axios from 'axios';
import { reqs } from '../../../axios/requests';

const AdminNav = () => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleAdminLogOut = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError('');

    try {
      const res = await axios.post(reqs.ADMIN_LOGOUT, null, {
        withCredentials: true,
      });

      if (!res.data?.succeed) {
        setLogoutError(res.data?.msg || 'Log out failed. Please try again.');
        return;
      }

      navigate('/admin-login');
    } catch (err) {
      setLogoutError(
        err.response?.data?.msg || 'Log out failed. Please try again.'
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <nav
      aria-label='Admin navigation'
      className='fixed flex flex-col min-h-screen justify-between gap-12 max-w-[185px] w-full pb-28'
    >
      <div className='grid gap-3'>
        {adminNavLinks.map((item, key) => (
          <NavLink
            key={key}
            to={item.path}
            className={({ isActive }) =>
              `py-2.5 px-4 flex items-center gap-3 group duration-300 transition-all text-lg text-muted-light w-full group hover:bg-primary-dark hover:text-onPrimary-main rounded-lg ${
                isActive &&
                !(window.location.pathname !== '/admin' && item.path === '') &&
                'bg-primary-dark text-onPrimary-main!'
              }`
            }
          >
            <item.icon
              aria-hidden='true'
              className='text-lg group-hover:transition-all group-hover:duration-300 group-hover:text-onPrimary-main'
            />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </div>
      <div className='grid gap-2'>
        {logoutError ? (
          <p
            className='px-4 text-sm text-red-300'
            id='admin-logout-error'
            role='alert'
          >
            {logoutError}
          </p>
        ) : null}
        <button
          type='button'
          disabled={loggingOut}
          aria-describedby={logoutError ? 'admin-logout-error' : undefined}
          className='py-2.5 px-4 flex items-center gap-3 group duration-300 transition-all text-lg text-muted-light w-full group hover:bg-primary-dark hover:text-onPrimary-main rounded-lg disabled:cursor-wait disabled:opacity-60'
          onClick={handleAdminLogOut}
        >
          <MdLogout
            aria-hidden='true'
            className='text-lg group-hover:transition-all group-hover:duration-300 group-hover:text-onPrimary-main'
          />
          <span>{loggingOut ? 'Logging out…' : 'Log out'}</span>
        </button>
      </div>
    </nav>
  );
};

export default AdminNav;
