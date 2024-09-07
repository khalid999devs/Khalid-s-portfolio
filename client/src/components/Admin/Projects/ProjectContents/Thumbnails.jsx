import React, { useEffect, useState } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { IoClose } from 'react-icons/io5';
import { reqFileWrapper } from '../../../../axios/requests';
import { MdDone } from 'react-icons/md';

const Thumbnails = ({ projectData, mode, handleSubmit, handleDelete }) => {
  const [thumbnails, setThumbnails] = useState([]);
  const [uploadedThumbnails, setUploadedThumbnails] = useState([]);

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

  console.log(thumbnails);

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 pt-7 col-span-10 lg:col-span-5'>
      <div className='grid w-full h-full gap-8'>
        <div className='grid w-full gap-3 h-full'>
          <h3 className='text-primary-main font-medium opacity-90 text-sm'>
            Thumbnail Contents
          </h3>
          <div className='flex w-full gap-5'>
            <div className='h-[160px] w-[230px]'>
              <ImgFileUploader
                dragActiveText={'Drop Banner Image here!'}
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

            <div className='flex flex-wrap flex-row h-full gap-2.5'>
              {thumbnails?.map((item, key) => {
                return (
                  <div
                    key={key}
                    className='w-[115px] h-[75px] rounded-md overflow-hidden bg-secondary-light relative'
                  >
                    <img
                      src={
                        !item.url
                          ? URL.createObjectURL(item)
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

export default Thumbnails;
