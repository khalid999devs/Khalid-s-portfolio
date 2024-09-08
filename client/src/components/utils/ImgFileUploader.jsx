import { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { IoImageOutline } from 'react-icons/io5';
import { RiImageAddLine } from 'react-icons/ri';
import { IoClose } from 'react-icons/io5';
import { handleCompressImg } from '../../utils/FileProcessing/ImageCompression';
import PrimaryButton from '../Buttons/PrimaryButton';
import { validFileWrapper } from '../../axios/requests';
import { FaVideo } from 'react-icons/fa';

const ImgFileUploader = ({
  mode,
  dragActiveText,
  fileImg,
  onLoad,
  type = 'multiple',
  compress = { state: false, maxSizeMb: 0.5, maxWidthOrHeight: 1920 },
  clearFileImg,
  placeholderText,
  dropContainerClass,
  imageContainerClass,
  thumbnail = false,
  textClasses,
  defaultImg,
  processText,
  PlaceholderImgIcon,
  dataURL = false,
  video = false,
  fileNumber,
  plaecholderIconCls,
}) => {
  const fileInputRef = useRef();
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach(async (file) => {
      setLoading(true);
      const reader = new FileReader();

      reader.onabort = () => console.log('file reading was aborted');
      reader.onerror = () => console.log('file reading has failed');
      // reader.onprogress = () => {
      //   console.log('progressing the upload');
      // };
      reader.onload = async () => {
        // const binaryStr = reader.result;
        // console.log(binaryStr);
        if (compress.state) {
          const compressedImg = await handleCompressImg(
            file,
            compress.maxSizeMb,
            compress.maxWidthOrHeight
          );
          if (thumbnail) {
            onLoad(file, compressedImg);
          } else {
            onLoad(compressedImg);
          }
        } else {
          onLoad(file);
        }
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    oClick: true,
    noKeyboard: true,
    multiple: type === 'multiple' ? true : false,
    // accept: 'image/*',
  });

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (fileImg?.name || typeof fileImg === 'string' || defaultImg) {
    return (
      <div
        className={
          'flex h-full w-full items-center justify-center relative cursor-pointer group ' +
          imageContainerClass
        }
      >
        <img
          src={dataURL ? fileImg : validFileWrapper(fileImg)}
          alt='FileImg'
          className='w-full h-full rounded-lg object-cover'
        />
        <div
          className='absolute right-[3%] top-[3%] bg-body-main bg-opacity-60 text-lg duration-500 group-hover:bg-opacity-80 w-[25px] h-[25px] rounded-full flex items-center justify-center cursor-pointer'
          onClick={clearFileImg}
        >
          <IoClose className='text-primary-main' />
        </div>
        {type === 'multiple' && fileNumber && (
          <div className='absolute bottom-[2%] right-[2%] bg-primary-dark text-primary-main text-md px-2 py-0.5 rounded-sm border-l-4 border-t-4 border-l-secondary-main border-t-secondary-main'>
            {fileNumber}
          </div>
        )}
        {video && (
          <div
            className='absolute text-4xl text-primary-main top-1/2 left-1/2'
            style={{ transform: 'translate(-50%,-50%)' }}
          >
            <FaVideo />
          </div>
        )}
        <div className='absolute left-0 bottom-0 w-max'>
          <PrimaryButton
            type={'small'}
            text={video ? 'Add video' : 'Add Image'}
            Icon={RiImageAddLine}
            classes={'!py-1 !px-1.5 rounded-none text-xs text-body-main'}
            onClick={openFileSelector}
          />
          <input
            {...getInputProps()}
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple={type === 'multiple' ? true : false}
          />
        </div>
      </div>
    );
  } else {
    return (
      <div
        {...getRootProps()}
        className={
          'flex w-full h-full items-center justify-center relative cursor-pointer flex-col border-2 border-secondary-main border-dashed p-4 rounded-lg ' +
          dropContainerClass
        }
      >
        <input
          {...getInputProps()}
          multiple={type === 'multiple' ? true : false}
        />
        <div className='w-[80%] flex text-center items-center justify-center flex-col gap-2 group'>
          {PlaceholderImgIcon ? (
            <PlaceholderImgIcon
              className={
                'text-5xl text-secondary-main opacity-80 ' + plaecholderIconCls
              }
            />
          ) : (
            <IoImageOutline
              className={
                'text-5xl text-secondary-main opacity-80 ' + plaecholderIconCls
              }
            />
          )}

          {/* <p className={'w-full opacity-80 !break-keep ' + textClasses}>
            {placeholderText ||
              `Drop your ${type === 'multiple' ? 'Images' : 'Image'}`}{' '}
            <br /> or{' '}
            <span
              className={
                'text-blue-600 text-sm duration-500 group-hover:underline ' +
                textClasses
              }
            >
              click to browse
            </span>
          </p> */}
        </div>
        <div
          className={`absolute top-[50%] left-[50%] text-onPrimary-main bg-secondary-main rounded-lg w-[97%] h-[95%] text-lg md:text-sm font-medium text-center p-3 ${
            isDragActive ? 'flex' : 'hidden'
          } justify-center items-center text-md`}
          style={{ transform: 'translate(-50%,-50%)' }}
        >
          {dragActiveText || 'Drop files here'}
        </div>
        {loading && (
          <div
            className={`absolute top-[50%] left-[50%] text-onPrimary-main bg-primary-main bg-opacity-95 rounded-lg w-[97%] h-[95%] text-lg font-medium flex flex-col justify-center items-center text-md text-center p-3`}
            style={{ transform: 'translate(-50%,-50%)' }}
          >
            <img
              src='/Images/loading.gif'
              className='w-[25px] h-[25px]'
              alt='Loading...'
            />
            <p className='text-xs text-tertiary-main font-medium break-words'>
              {processText || 'Processing Image'}
            </p>
          </div>
        )}
      </div>
    );
  }
};

export default ImgFileUploader;
