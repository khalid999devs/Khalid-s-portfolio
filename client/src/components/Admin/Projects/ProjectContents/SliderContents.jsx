import { useState } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import { reqFileWrapper } from '../../../../axios/requests';
import { IoClose } from 'react-icons/io5';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { MdDone } from 'react-icons/md';
import PropTypes from 'prop-types';
import useSyncedState from '../../../../hooks/useSyncedState';
import useObjectUrls from '../../../../hooks/useObjectUrls';

const SliderContents = ({ projectData, mode, handleSubmit, handleDelete }) => {
  const [sliderContents, setSliderContents] = useSyncedState(
    [],
    () => (projectData?.id && projectData?.sliderContents) || undefined,
    [mode, projectData]
  );
  const [uploadedSliders, setUploadedSliders] = useState([]);
  const previews = useObjectUrls(sliderContents);

  const handleAddSliderContents = () => {
    if (uploadedSliders.length < 1) {
      alert('Please upload a Slider Content first!');
      return;
    }
    handleSubmit({ sliderContents: uploadedSliders }, 'sliderContents');
    setUploadedSliders([]);
  };

  const removeSliderContent = (contentId) => {
    if (contentId) {
      handleDelete('sliderContents', contentId);
      setSliderContents((sliders) => [
        ...sliders.filter((slider) => slider.id !== contentId),
      ]);
    }
  };

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-56.25 p-8 pt-7 col-span-10'>
      <div className='grid w-full h-full gap-8'>
        <div className='flex flex-col gap-4 sm:flex-row w-full sm:gap-5 h-full'>
          <h3 className='text-primary-main font-medium opacity-90 text-sm min-w-max'>
            Slider Contents
          </h3>
          <div className='flex flex-col md:flex-row w-full gap-5'>
            <div className='min-h-40 h-48.75 min-w-[260] max-w-71.25 w-full'>
              <ImgFileUploader
                dragActiveText={'Drop Slider Contents here!'}
                fileImg={uploadedSliders[uploadedSliders.length - 1] || null}
                onLoad={(file) => setUploadedSliders((prev) => [...prev, file])}
                mode={mode}
                clearFileImg={() => setUploadedSliders([])}
                fileNumber={uploadedSliders?.length}
                // plaecholderIconCls={`text-4xl!`}
              />
            </div>

            <div className='flex flex-wrap flex-row h-full gap-2.5'>
              {sliderContents?.map((item, key) => {
                return (
                  <div
                    key={key}
                    className='w-28.75 h-22.5 rounded-md overflow-hidden bg-secondary-light relative'
                  >
                    <img
                      src={
                        item.url ? reqFileWrapper(item.url) : previews.get(item)
                      }
                      className='w-full h-full object-cover'
                      alt={'slider ' + item.id}
                    />
                    <div
                      className='absolute right-[3%] top-[3%] bg-body-main/70 text-sm duration-500 group-hover:bg-body-main w-5.5 h-5.5 rounded-full flex items-center justify-center cursor-pointer'
                      onClick={(e) => {
                        e.preventDefault();
                        item.id && removeSliderContent(item.id);
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
};

export default SliderContents;
