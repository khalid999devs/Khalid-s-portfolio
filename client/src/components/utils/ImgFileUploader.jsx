import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { IoImageOutline } from 'react-icons/io5';
import { RiImageAddLine } from 'react-icons/ri';
import { IoClose } from 'react-icons/io5';
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
  'video/mp4': ['.mp4'],
};
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ImgFileUploader = ({
  dragActiveText,
  fileImg,
  onLoad,
  type = 'multiple',
  clearFileImg,
  dropContainerClass = '',
  imageContainerClass = '',
  defaultImg,
  PlaceholderImgIcon,
  dataURL = false,
  video = false,
  fileNumber,
  placeholderIconClass = '',
  maxFiles,
  currentFileCount = 0,
  disabled = false,
}) => {
  const [processError, setProcessError] = useState('');
  const [previewSource, setPreviewSource] = useState(null);
  const configuredMaxFiles = maxFiles ?? (video ? 4 : 8);
  const remainingFiles =
    type === 'multiple'
      ? Math.max(configuredMaxFiles - currentFileCount, 0)
      : 1;
  const uploadDisabled = disabled || remainingFiles === 0;
  const remainingFileLabel = `${video ? 'video' : 'image'}${
    remainingFiles === 1 ? '' : 's'
  }`;
  const capacityError =
    currentFileCount > 0
      ? `You can select ${remainingFiles} more ${remainingFileLabel} in this batch.`
      : `You can select at most ${configuredMaxFiles} ${
          video ? 'videos' : 'images'
        } at a time.`;

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
    (acceptedFiles) => {
      if (!acceptedFiles.length || uploadDisabled) return;

      const filesToProcess =
        type === 'multiple'
          ? acceptedFiles.slice(0, remainingFiles)
          : acceptedFiles.slice(0, 1);

      if (filesToProcess.length < acceptedFiles.length) {
        setProcessError(capacityError);
      }

      if (filesToProcess.length === acceptedFiles.length) {
        setProcessError('');
      }

      filesToProcess.forEach((file) => onLoad(file));
    },
    [
      onLoad,
      uploadDisabled,
      type,
      remainingFiles,
      capacityError,
    ]
  );

  const handleDropRejected = useCallback(
    (rejections) => {
      const firstError = rejections[0]?.errors?.[0]?.code;
      setProcessError(
        firstError === 'file-too-large'
          ? 'Files must be no larger than 25 MB.'
          : firstError === 'too-many-files'
          ? capacityError
          : 'Select a supported file type.'
      );
    },
    [capacityError]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: video ? VIDEO_ACCEPT : IMAGE_ACCEPT,
    maxFiles: type === 'multiple' ? configuredMaxFiles : 1,
    maxSize: MAX_UPLOAD_BYTES,
    noKeyboard: false,
    onDrop,
    onDropRejected: handleDropRejected,
    multiple: type === 'multiple',
    disabled: uploadDisabled,
  });

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
        {processError && (
          <p
            role='alert'
            className='absolute left-2 right-2 top-2 rounded bg-red-800 px-2 py-1 text-center text-xs text-primary-main'
          >
            {processError}
          </p>
        )}
        <div className='absolute left-0 bottom-0 w-max'>
          <PrimaryButton
            disabled={uploadDisabled}
            type='button'
            state='small'
            text={video ? 'Add video' : 'Add Image'}
            Icon={RiImageAddLine}
            classes={'py-1! px-1.5! rounded-none text-xs text-body-main'}
            onClick={open}
          />
          <input {...getInputProps()} disabled={uploadDisabled} />
        </div>
      </div>
    );
  } else {
    return (
      <div
        {...getRootProps({
          role: 'button',
          'aria-disabled': uploadDisabled,
          'aria-label': video
            ? 'Upload video files'
            : `Upload ${type === 'multiple' ? 'image files' : 'an image'}`,
        })}
        className={
          `flex w-full h-full items-center justify-center relative flex-col border-2 border-secondary-main border-dashed p-4 rounded-lg ${
            uploadDisabled
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer'
          } ` +
          dropContainerClass
        }
      >
        <input
          {...getInputProps()}
          disabled={uploadDisabled}
          multiple={type === 'multiple' ? true : false}
        />
        <div className='w-[80%] flex text-center items-center justify-center flex-col gap-2 group'>
          {PlaceholderImgIcon ? (
            <PlaceholderImgIcon
              className={
                'text-5xl text-muted-main opacity-80 ' +
                placeholderIconClass
              }
            />
          ) : (
            <IoImageOutline
              className={
                'text-5xl text-muted-main opacity-80 ' +
                placeholderIconClass
              }
            />
          )}

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
        {processError && (
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
  dragActiveText: PropTypes.string,
  fileImg: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  onLoad: PropTypes.func.isRequired,
  type: PropTypes.string,
  clearFileImg: PropTypes.func,
  dropContainerClass: PropTypes.string,
  imageContainerClass: PropTypes.string,
  defaultImg: PropTypes.string,
  PlaceholderImgIcon: PropTypes.elementType,
  dataURL: PropTypes.bool,
  video: PropTypes.bool,
  fileNumber: PropTypes.number,
  placeholderIconClass: PropTypes.string,
  maxFiles: PropTypes.number,
  currentFileCount: PropTypes.number,
  disabled: PropTypes.bool,
};

export default ImgFileUploader;
