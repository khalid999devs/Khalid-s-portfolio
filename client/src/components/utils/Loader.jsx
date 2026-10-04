import { loadingGif } from '../../assets';
import PropTypes from 'prop-types';

const Loader = ({ classes }) => {
  return (
    <div
      className={'w-full grow flex items-start justify-center ' + classes}
    >
      <img
        src={loadingGif}
        className='w-25 h-25'
        alt='loading img'
        loading='eager'
      />
    </div>
  );
};


Loader.propTypes = {
  classes: PropTypes.string,
};

export default Loader;
