import { useEffect, useState } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { IoClose } from 'react-icons/io5';
import { reqFileWrapper } from '../../../../axios/requests';
import { MdDone } from 'react-icons/md';
import PropTypes from 'prop-types';
import useObjectUrl from '../../../../hooks/useObjectUrl';

const ThumbnailPreview = ({ item, index }) => {
  const objectUrl = useObjectUrl(item?.url ? null : item);
  const source = item?.url ? reqFileWrapper(item.url) : objectUrl;

  return source ? (
    <img
      src={source}
      className='w-full h-full object-cover'
      alt={`Project thumbnail ${index + 1}`}
    />
  ) : null;
};

ThumbnailPreview.propTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
};

const Thumbnails = ({
  projectData,
  mode,
  handleSubmit,
  handleDelete,
  disabled,
}) => {
  const [thumbnails, setThumbnails] = useState([]);
  const [uploadedThumbnails, setUploadedThumbnails] = useState([]);

  useEffect(() => {
    if (projectData?.id && projectData?.thumbnailContents) {
      setThumbnails(projectData.thumbnailContents);
    }
  }, [mode, projectData]);

  const handleAddThumbnails = async () => {
    if (uploadedThumbnails.length < 1) {
      alert('Please upload a thumbnail first!');
      return;
    }
    // setThumbnails((thumbnails) => [...thumbnails, ...uploadedThumbnails]);
    if (
      await handleSubmit(
        { thumbnailContents: uploadedThumbnails },
        'thumbnailContents'
      )
    ) {
      setUploadedThumbnails([]);
    }
  };

  const removeThumbnail = (contentId) => {
    if (contentId) {
      handleDelete('thumbnailContents', contentId).then((deleted) => {
        if (deleted) {
          setThumbnails((currentThumbnails) =>
            currentThumbnails.filter(
              (thumbnail) => thumbnail.id !== contentId
            )
          );
        }
      });
    }
  };

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
                disabled={disabled}
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
                plaecholderIconCls='text-4xl!'
              />
            </div>

            <div className='flex flex-wrap flex-row gap-2'>
              {thumbnails?.map((item, key) => {
                return (
                  <div
                    key={key}
                    className='w-[112px] h-[90px] md:w-[100px] md:h-[75px] rounded-md overflow-hidden bg-secondary-light relative'
                  >
                    <ThumbnailPreview item={item} index={key} />
                    <button
                      disabled={disabled}
                      type='button'
                      aria-label={`Remove thumbnail ${key + 1}`}
                      className='absolute right-[3%] top-[3%] bg-body-main/70 text-sm duration-500 group-hover:bg-body-main w-[22px] h-[22px] rounded-full flex items-center justify-center cursor-pointer'
                      onClick={(e) => {
                        e.preventDefault();
                        item.id && removeThumbnail(item.id);
                      }}
                    >
                      <IoClose aria-hidden='true' className='text-primary-main' />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* button */}
        <div className='flex w-full items-end justify-end'>
          <PrimaryButton
            disabled={disabled}
            state='small'
            text={mode === 'create' ? 'DONE' : 'SAVE'}
            Icon={MdDone}
            classes='rounded-full!'
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
  disabled: PropTypes.bool,
};

export default Thumbnails;
