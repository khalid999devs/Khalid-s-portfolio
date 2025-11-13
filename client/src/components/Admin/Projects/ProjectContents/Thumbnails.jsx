import { useEffect, useState, useRef } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { IoClose } from 'react-icons/io5';
import { reqFileWrapper } from '../../../../axios/requests';
import { MdDone } from 'react-icons/md';
import PropTypes from 'prop-types';

const Thumbnails = ({ projectData, mode, handleSubmit, handleDelete }) => {
  const [thumbnails, setThumbnails] = useState([]);
  const [uploadedThumbnails, setUploadedThumbnails] = useState([]);
  const imageURLsRef = useRef(new Map()); // Track created Object URLs

  useEffect(() => {
    if (projectData?.id && projectData?.thumbnailContents) {
      setThumbnails(projectData.thumbnailContents);
    }
  }, [mode, projectData]);

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

  // Cleanup all Object URLs on unmount
  useEffect(() => {
    const urlMap = imageURLsRef.current;
    return () => {
      urlMap.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      urlMap.clear();
    };
  }, []);

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 pt-7 col-span-10 lg:col-span-5'>
      <div className='grid w-full h-full gap-8'>
        <div className='grid w-full gap-3 h-full'>
          <h3 className='text-primary-main font-medium opacity-90 text-sm'>
            Thumbnail Contents
          </h3>
          <div className='flex flex-col md:flex-row w-full gap-5'>
            <div className='h-[160px] md:max-w-[185px] w-full'>
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
                plaecholderIconCls={`!text-4xl`}
              />
            </div>

            <div className='flex flex-wrap flex-row gap-2'>
              {thumbnails?.map((item, key) => {
                return (
                  <div
                    key={key}
                    className='w-[112px] h-[90px] md:w-[100px] md:h-[75px] rounded-md overflow-hidden bg-secondary-light relative'
                  >
                    <img
                      src={
                        !item.url
                          ? (() => {
                              const imgKey = `thumbnail-${key}`;
                              if (!imageURLsRef.current.has(imgKey)) {
                                const url = URL.createObjectURL(item);
                                imageURLsRef.current.set(imgKey, url);
                              }
                              return imageURLsRef.current.get(imgKey);
                            })()
                          : reqFileWrapper(item.url)
                      }
                      className='w-full h-full object-cover'
                      alt={'thumbnail ' + item.id}
                    />
                    <div
                      className='absolute right-[3%] top-[3%] bg-body-main bg-opacity-70 text-sm duration-500 group-hover:bg-opacity-100 w-[22px] h-[22px] rounded-full flex items-center justify-center cursor-pointer'
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
            classes={`!rounded-full`}
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
