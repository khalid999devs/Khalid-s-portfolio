import { useEffect, useState } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import PropTypes from 'prop-types';

const Banner = ({
  projectData,
  handleSubmit,
  mode,
  handleDelete,
  disabled,
}) => {
  const [banner, setBanner] = useState({});

  useEffect(() => {
    if (projectData?.id && projectData?.bannerImg) {
      setBanner(projectData.bannerImg);
    }
  }, [mode, projectData]);

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 col-span-10 lg:col-span-4'>
      <div className='flex flex-col w-full gap-3 h-full'>
        <h3 className='text-muted-light font-medium opacity-90 text-sm h-min'>
          Project Banner
        </h3>
        <div className='h-full w-full'>
          <ImgFileUploader
            dragActiveText={'Drop Banner Image here!'}
            fileImg={banner}
            onLoad={async (file) => {
              if (await handleSubmit({ bannerImg: file }, 'bannerImg')) {
                setBanner(file);
              }
            }}
            clearFileImg={() => {
              handleDelete('bannerImg').then((deleted) => {
                if (deleted) setBanner({});
              });
            }}
            type='single'
            disabled={disabled}
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
  disabled: PropTypes.bool,
};

export default Banner;
