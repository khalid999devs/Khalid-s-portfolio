import NavLogo from './NavLogo';
import NotificationBell from './NotificationBell';
import Avatar from './Avatar';
import Searchinput from '../../Forms/Searchinput';
import PropTypes from 'prop-types';

const AdminBar = ({ title, loginState = false, searchTerm = '', onSearch }) => {
  return (
    <div className='screen-max-width sec-x-padding py-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-10 '>
          <NavLogo />
          <h1 className='text-xl'>{title || 'Admin Page Title'}</h1>
        </div>
        {!loginState && (
          <div className='flex items-center gap-32'>
            <div className='hidden md:block'>
              <Searchinput value={searchTerm} onChange={onSearch} />
            </div>
            <div className='flex items-center gap-3'>
              <NotificationBell />
              <Avatar />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


AdminBar.propTypes = {
  title: PropTypes.string,
  loginState: PropTypes.bool,
  searchTerm: PropTypes.string,
  onSearch: PropTypes.func,
};

export default AdminBar;
