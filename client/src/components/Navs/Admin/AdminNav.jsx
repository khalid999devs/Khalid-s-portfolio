import { adminNavLinks } from '../../../Constants';
import { NavLink, useNavigate } from 'react-router-dom';
import { MdLogout } from 'react-icons/md';
import axios from 'axios';
import { reqs } from '../../../axios/requests';

const AdminNav = () => {
  const navigate = useNavigate();

  const handleAdminLogOut = (e) => {
    e.preventDefault();
    axios
      .post(reqs.ADMIN_LOGOUT, null, { withCredentials: true })
      .then((res) => {
        if (res.data.succeed) navigate('/admin-login');
        else alert(res.data.msg);
      })
      .catch((err) => alert(err.response?.data?.msg || 'An error occurred'));
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
      <div>
        <button
          type='button'
          className='py-2.5 px-4 flex items-center gap-3 group duration-300 transition-all text-lg text-muted-light w-full group hover:bg-primary-dark hover:text-onPrimary-main rounded-lg'
          onClick={handleAdminLogOut}
        >
          <MdLogout
            aria-hidden='true'
            className='text-lg group-hover:transition-all group-hover:duration-300 group-hover:text-onPrimary-main'
          />
          <span>Log out</span>
        </button>
      </div>
    </nav>
  );
};

export default AdminNav;
