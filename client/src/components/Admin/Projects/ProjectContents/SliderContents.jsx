import { useEffect, useState } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import { reqFileWrapper } from '../../../../axios/requests';
import { IoClose } from 'react-icons/io5';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { MdDone } from 'react-icons/md';
import PropTypes from 'prop-types';
import useObjectUrl from '../../../../hooks/useObjectUrl';

const SliderImagePreview = ({ item, index }) => {
  const objectUrl = useObjectUrl(item?.url ? null : item);
  const source = item?.url ? reqFileWrapper(item.url) : objectUrl;

  return source ? (
    <img
      src={source}
      className='w-full h-full object-cover'
      alt={`Project slider image ${index + 1}`}
    />
  ) : null;
};

SliderImagePreview.propTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
};

const SliderContents = ({
  projectData,
  mode,
  handleSubmit,
  handleDelete,
  disabled,
}) => {
  const [sliderContents, setSliderContents] = useState([]);
  const [uploadedSliders, setUploadedSliders] = useState([]);

  useEffect(() => {
    if (projectData?.id && projectData?.sliderContents) {
      setSliderContents(projectData.sliderContents);
    }
  }, [mode, projectData]);

  const handleAddSliderContents = async () => {
    if (uploadedSliders.length < 1) {
      alert('Please upload a Slider Content first!');
      return;
    }
    if (
      await handleSubmit(
        { sliderContents: uploadedSliders },
        'sliderContents'
      )
    ) {
      setUploadedSliders([]);
    }
  };

  const removeSliderContent = (contentId) => {
    if (contentId) {
      handleDelete('sliderContents', contentId).then((deleted) => {
        if (deleted) {
          setSliderContents((currentSliders) =>
            currentSliders.filter((slider) => slider.id !== contentId)
          );
        }
      });
    }
  };

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 pt-7 col-span-10'>
      <div className='grid w-full h-full gap-8'>
        <div className='flex flex-col gap-4 sm:flex-row w-full sm:gap-5 h-full'>
          <h3 className='text-primary-main font-medium opacity-90 text-sm min-w-max'>
            Slider Contents
          </h3>
          <div className='flex flex-col md:flex-row w-full gap-5'>
            <div className='min-h-[160px] h-[195px] min-w-[260px] max-w-[285px] w-full'>
              <ImgFileUploader
                disabled={disabled}
                dragActiveText={'Drop Slider Contents here!'}
                fileImg={uploadedSliders[uploadedSliders.length - 1] || null}
                onLoad={(file) => setUploadedSliders((prev) => [...prev, file])}
                mode={mode}
                clearFileImg={() => setUploadedSliders([])}
                fileNumber={uploadedSliders?.length}
                // plaecholderIconCls='text-4xl!'
              />
            </div>

            <div className='flex flex-wrap flex-row h-full gap-2.5'>
              {sliderContents?.map((item, key) => {
                return (
                  <div
                    key={key}
                    className='w-[115px] h-[90px] rounded-md overflow-hidden bg-secondary-light relative'
                  >
                    <SliderImagePreview item={item} index={key} />
                    <button
                      disabled={disabled}
                      type='button'
                      aria-label={`Remove slider image ${key + 1}`}
                      className='absolute right-[3%] top-[3%] bg-body-main/70 text-sm duration-500 group-hover:bg-body-main w-[22px] h-[22px] rounded-full flex items-center justify-center cursor-pointer'
                      onClick={(e) => {
                        e.preventDefault();
                        item.id && removeSliderContent(item.id);
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
            onClick={handleAddSliderContents}
          />
        </div>
      </div>
    </div>
  );
};

SliderContents.propTypes = {
  projectData: PropTypes.shape({
    id: PropTypes.number,
    sliderContents: PropTypes.array,
  }),
  mode: PropTypes.string,
  handleSubmit: PropTypes.func,
  handleDelete: PropTypes.func,
  disabled: PropTypes.bool,
};

export default SliderContents;
