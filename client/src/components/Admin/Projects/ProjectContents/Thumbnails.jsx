import { useState } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { IoClose } from 'react-icons/io5';
import { reqFileWrapper } from '../../../../axios/requests';
import { MdDone } from 'react-icons/md';
import PropTypes from 'prop-types';
import useSyncedState from '../../../../hooks/useSyncedState';
import useObjectUrls from '../../../../hooks/useObjectUrls';

const Thumbnails = ({ projectData, mode, handleSubmit, handleDelete }) => {
  const [thumbnails, setThumbnails] = useSyncedState(
    [],
    () => (projectData?.id && projectData?.thumbnailContents) || undefined,
    [mode, projectData]
  );
  const [uploadedThumbnails, setUploadedThumbnails] = useState([]);
  const previews = useObjectUrls(thumbnails);

  const handleAddThumbnails = () => {
    if (uploadedThumbnails.length < 1) {
      alert('Please upload a thumbnail first!');
      return;
    }
    // setThumbnails((thumbnails) => [...thumbnails, ...uploadedThumbnails]);
    handleSubmit(
      { thumbnailContents: uploadedThumbnails },
      'thumbnailContents'
    );
    setUploadedThumbnails([]);
  };

  const removeThumbnail = (contentId) => {
    if (contentId) {
      handleDelete('thumbnailContents', contentId);
      setThumbnails((thumbnails) => [
        ...thumbnails.filter((thumbnail) => thumbnail.id !== contentId),
      ]);
    }
  };

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-56.25 p-8 pt-7 col-span-10 lg:col-span-5'>
      <div className='grid w-full h-full gap-8'>
        <div className='grid w-full gap-3 h-full'>
          <h3 className='text-primary-main font-medium opacity-90 text-sm'>
            Thumbnail Contents
          </h3>
          <div className='flex flex-col md:flex-row w-full gap-5'>
            <div className='h-40 md:max-w-46.25 w-full'>
              <ImgFileUploader
                dragActiveText={'Drop Thumbnail Image here!'}
                fileImg={
                  uploadedThumbnails[uploadedThumbnails.length - 1] || null
                }
                onLoad={(file) =>
                  setUploadedThumbnails((prev) => [...prev, file])
                }
                mode={mode}
                clearFileImg={() => setUploadedThumbnails([])}
                fileNumber={uploadedThumbnails?.length}
                plaecholderIconCls={`text-4xl!`}
              />
            </div>

            <div className='flex flex-wrap flex-row gap-2'>
              {thumbnails?.map((item, key) => {
                return (
                  <div
                    key={key}
                    className='w-28 h-22.5 md:w-25 md:h-18.75 rounded-md overflow-hidden bg-secondary-light relative'
                  >
                    <img
                      src={
                        item.url ? reqFileWrapper(item.url) : previews.get(item)
                      }
                      className='w-full h-full object-cover'
                      alt={'thumbnail ' + item.id}
                    />
                    <div
                      className='absolute right-[3%] top-[3%] bg-body-main/70 text-sm duration-500 group-hover:bg-body-main w-5.5 h-5.5 rounded-full flex items-center justify-center cursor-pointer'
                      onClick={(e) => {
                        e.preventDefault();
                        item.id && removeThumbnail(item.id);
                      }}
                    >
                      <IoClose className='text-primary-main' />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* button */}
        <div className='flex w-full items-end justify-end'>
          <PrimaryButton
            state='small'
            text={mode === 'create' ? 'DONE' : 'SAVE'}
            Icon={MdDone}
            classes={`rounded-full!`}
            onClick={handleAddThumbnails}
          />
        </div>
      </div>
    </div>
  );
};

Thumbnails.propTypes = {
  projectData: PropTypes.shape({
    id: PropTypes.number,
    thumbnailContents: PropTypes.array,
  }),
  mode: PropTypes.string,
  handleSubmit: PropTypes.func,
  handleDelete: PropTypes.func,
};

export default Thumbnails;
