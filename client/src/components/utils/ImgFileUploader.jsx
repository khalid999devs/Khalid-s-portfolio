import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { IoImageOutline } from 'react-icons/io5';
import { RiImageAddLine } from 'react-icons/ri';
import { IoClose } from 'react-icons/io5';
import { handleCompressImg } from '../../utils/FileProcessing/ImageCompression';
import PrimaryButton from '../Buttons/PrimaryButton';
import { reqFileWrapper } from '../../axios/requests';
import { FaVideo } from 'react-icons/fa';
import PropTypes from 'prop-types';

const IMAGE_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};
const VIDEO_ACCEPT = {
  'audio/wav': ['.wav'],
  'video/mp4': ['.mp4'],
  'video/x-matroska': ['.mkv'],
};
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ImgFileUploader = ({
  dragActiveText,
  fileImg,
  onLoad,
  type = 'multiple',
  compress = { state: false, maxSizeMb: 0.5, maxWidthOrHeight: 1920 },
  clearFileImg,
  dropContainerClass,
  imageContainerClass,
  thumbnail = false,
  defaultImg,
  processText,
  PlaceholderImgIcon,
  dataURL = false,
  video = false,
  fileNumber,
  plaecholderIconCls,
  maxFiles,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [processError, setProcessError] = useState('');
  const [previewSource, setPreviewSource] = useState(null);
  const processingGenerationRef = useRef(0);

  useEffect(() => {
    const previewValue = fileImg || defaultImg;
    let objectUrl;

    if (dataURL && typeof previewValue === 'string') {
      setPreviewSource(previewValue);
    } else if (typeof Blob !== 'undefined' && previewValue instanceof Blob) {
      objectUrl = URL.createObjectURL(previewValue);
      setPreviewSource(objectUrl);
    } else {
      setPreviewSource(reqFileWrapper(previewValue));
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [dataURL, defaultImg, fileImg]);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (!acceptedFiles.length) return;

      const generation = ++processingGenerationRef.current;
      setLoading(true);
      setProcessError('');

      try {
        const processedFiles = await Promise.all(
          acceptedFiles.map(async (file) => {
            if (!compress.state || video) return { file, processed: file };

            const processed = await handleCompressImg(
              file,
              compress.maxSizeMb,
              compress.maxWidthOrHeight
            );
            return { file, processed };
          })
        );

        if (generation !== processingGenerationRef.current) return;
        processedFiles.forEach(({ file, processed }) => {
          if (thumbnail) {
            onLoad(file, processed);
          } else {
            onLoad(processed);
          }
        });
      } catch {
        if (generation === processingGenerationRef.current) {
          setProcessError('The selected file could not be processed.');
        }
      } finally {
        if (generation === processingGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [
      compress.state,
      compress.maxSizeMb,
      compress.maxWidthOrHeight,
      thumbnail,
      onLoad,
      video,
    ]
  );

  const handleDropRejected = useCallback((rejections) => {
    const firstError = rejections[0]?.errors?.[0]?.code;
    setProcessError(
      firstError === 'file-too-large'
        ? 'Files must be no larger than 25 MB.'
        : firstError === 'too-many-files'
        ? 'Too many files were selected.'
        : 'Select a supported file type.'
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: video ? VIDEO_ACCEPT : IMAGE_ACCEPT,
    maxFiles: type === 'multiple' ? maxFiles || (video ? 4 : 8) : 1,
    maxSize: MAX_UPLOAD_BYTES,
    noKeyboard: false,
    onDrop,
    onDropRejected: handleDropRejected,
    multiple: type === 'multiple',
    disabled,
  });

  useEffect(() => {
    return () => {
      processingGenerationRef.current += 1;
    };
  }, []);

  if (previewSource) {
    return (
      <div
        className={
          'flex h-full w-full items-center justify-center relative group ' +
          imageContainerClass
        }
      >
        <img
          src={previewSource}
          alt={video ? 'Selected video preview' : 'Selected image preview'}
          className='w-full h-full rounded-lg object-cover'
        />
        <button
          disabled={disabled}
          type='button'
          aria-label={video ? 'Remove selected video' : 'Remove selected image'}
          className='absolute right-[3%] top-[3%] bg-body-main/60 text-lg duration-500 group-hover:bg-body-main/80 w-[25px] h-[25px] rounded-full flex items-center justify-center cursor-pointer'
          onClick={clearFileImg}
        >
          <IoClose aria-hidden='true' className='text-primary-main' />
        </button>
        {type === 'multiple' && fileNumber && (
          <div className='absolute bottom-[2%] right-[2%] bg-primary-dark text-primary-main text-base px-2 py-0.5 rounded-xs border-l-4 border-t-4 border-l-secondary-main border-t-secondary-main'>
            {fileNumber}
          </div>
        )}
        {video && (
          <div
            aria-hidden='true'
            className='absolute text-4xl text-primary-main top-1/2 left-1/2'
            style={{ transform: 'translate(-50%,-50%)' }}
          >
            <FaVideo />
          </div>
        )}
        <div className='absolute left-0 bottom-0 w-max'>
          <PrimaryButton
            disabled={disabled}
            type='button'
            state='small'
            text={video ? 'Add video' : 'Add Image'}
            Icon={RiImageAddLine}
            classes={'py-1! px-1.5! rounded-none text-xs text-body-main'}
            onClick={open}
          />
          <input {...getInputProps()} />
        </div>
      </div>
    );
  } else {
    return (
      <div
        {...getRootProps({
          role: 'button',
          'aria-label': video
            ? 'Upload video files'
            : `Upload ${type === 'multiple' ? 'image files' : 'an image'}`,
        })}
        className={
          `flex w-full h-full items-center justify-center relative flex-col border-2 border-secondary-main border-dashed p-4 rounded-lg ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          } ` +
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
                'text-5xl text-muted-main opacity-80 ' + plaecholderIconCls
              }
            />
          ) : (
            <IoImageOutline
              className={
                'text-5xl text-muted-main opacity-80 ' + plaecholderIconCls
              }
            />
          )}

          {/* <p className={'w-full opacity-80 break-keep! ' + textClasses}>
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
          role='status'
          aria-live='polite'
          className={`absolute top-[50%] left-[50%] text-onPrimary-main bg-secondary-main rounded-lg w-[97%] h-[95%] text-lg md:text-sm font-medium text-center p-3 ${
            isDragActive ? 'flex' : 'hidden'
          } justify-center items-center text-base`}
          style={{ transform: 'translate(-50%,-50%)' }}
        >
          {dragActiveText || 'Drop files here'}
        </div>
        {loading && (
          <div
            role='status'
            aria-live='polite'
            className='absolute top-[50%] left-[50%] text-body-main bg-primary-main/95 rounded-lg w-[97%] h-[95%] text-lg font-medium flex flex-col justify-center items-center text-base text-center p-3'
            style={{ transform: 'translate(-50%,-50%)' }}
          >
            <img
              src='/Images/loading.gif'
              className='w-[25px] h-[25px]'
              alt='Loading...'
            />
            <p className='text-xs text-body-main font-medium break-words'>
              {processText || 'Processing Image'}
            </p>
          </div>
        )}
        {processError && !loading && (
          <p
            role='alert'
            className='absolute bottom-2 left-2 right-2 rounded bg-red-800 px-2 py-1 text-center text-xs text-primary-main'
          >
            {processError}
          </p>
        )}
      </div>
    );
  }
};

ImgFileUploader.propTypes = {
  mode: PropTypes.string,
  dragActiveText: PropTypes.string,
  fileImg: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  onLoad: PropTypes.func.isRequired,
  type: PropTypes.string,
  compress: PropTypes.shape({
    state: PropTypes.bool,
    maxSizeMb: PropTypes.number,
    maxWidthOrHeight: PropTypes.number,
  }),
  clearFileImg: PropTypes.func,
  placeholderText: PropTypes.string,
  dropContainerClass: PropTypes.string,
  imageContainerClass: PropTypes.string,
  thumbnail: PropTypes.bool,
  textClasses: PropTypes.string,
  defaultImg: PropTypes.string,
  processText: PropTypes.string,
  PlaceholderImgIcon: PropTypes.elementType,
  dataURL: PropTypes.bool,
  video: PropTypes.bool,
  fileNumber: PropTypes.number,
  plaecholderIconCls: PropTypes.string,
  maxFiles: PropTypes.number,
  disabled: PropTypes.bool,
};

export default ImgFileUploader;
