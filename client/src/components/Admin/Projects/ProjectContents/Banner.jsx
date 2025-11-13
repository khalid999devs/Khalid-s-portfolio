import { useEffect, useState } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import PropTypes from 'prop-types';

const Banner = ({ projectData, handleSubmit, mode, handleDelete }) => {
  const [banner, setBanner] = useState({});

  useEffect(() => {
    if (projectData?.id && projectData?.bannerImg) {
      setBanner(projectData.bannerImg);
    }
  }, [mode, projectData]);

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 col-span-10 lg:col-span-4'>
      <div className='flex flex-col w-full gap-3 h-full'>
        <h3 className='text-secondary-light font-medium opacity-90 text-sm h-min'>
          Project Banner
        </h3>
        <div className='h-full w-full'>
          <ImgFileUploader
            dragActiveText={'Drop Banner Image here!'}
            fileImg={banner}
            onLoad={(file) => {
              setBanner(file);
              handleSubmit({ bannerImg: file }, 'bannerImg');
            }}
            mode={mode}
            clearFileImg={() => {
              handleDelete('bannerImg');
              setBanner({});
            }}
            type='single'
          />
        </div>
      </div>
    </div>
  );
};


Banner.propTypes = {
  projectData: PropTypes.shape({
    id: PropTypes.number,
    bannerImg: PropTypes.string,
  }),
  handleSubmit: PropTypes.func,
  mode: PropTypes.string,
  handleDelete: PropTypes.func,
};

export default Banner;
