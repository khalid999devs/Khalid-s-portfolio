import { useCallback, useEffect, useState, useRef } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { IoMdAdd } from 'react-icons/io';
import { MdOutlineOndemandVideo } from 'react-icons/md';
import { reqFileWrapper } from '../../../../axios/requests';
import { FaPlay, FaPause } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import PropTypes from 'prop-types';
import useObjectUrl from '../../../../hooks/useObjectUrl';

const VideoPreview = ({
  index,
  isPlaying,
  item,
  onRemove,
  onToggle,
  disabled,
}) => {
  const videoRef = useRef(null);
  const objectUrl = useObjectUrl(item?.url ? null : item);
  const source = item?.url ? reqFileWrapper(item.url) : objectUrl;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.play().catch(() => videoElement.pause());
    } else {
      videoElement.pause();
    }
  }, [isPlaying]);

  return (
    <div className='w-[128px] h-[100px] bg-black rounded-lg relative overflow-hidden group'>
      <video
        ref={videoRef}
        src={source || undefined}
        playsInline
        preload='metadata'
        muted
        aria-hidden='true'
        className='w-full h-full object-cover'
      ></video>
      <button
        disabled={disabled}
        type='button'
        aria-label={isPlaying ? 'Pause video preview' : 'Play video preview'}
        className='absolute inset-0 flex items-center justify-center text-xl text-primary-main'
        onClick={onToggle}
      >
        {isPlaying ? (
          <FaPause aria-hidden='true' />
        ) : (
          <FaPlay aria-hidden='true' />
        )}
      </button>
      <button
        disabled={disabled}
        type='button'
        aria-label={`Remove video ${index + 1}`}
        className='absolute right-[3%] top-[3%] bg-body-main/70 text-sm duration-500 group-hover:bg-body-main w-[22px] h-[22px] rounded-full flex items-center justify-center cursor-pointer'
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (item.id) onRemove(item.id);
        }}
      >
        <IoClose aria-hidden='true' className='text-primary-main' />
      </button>
    </div>
  );
};

VideoPreview.propTypes = {
  index: PropTypes.number.isRequired,
  isPlaying: PropTypes.bool.isRequired,
  item: PropTypes.object.isRequired,
  onRemove: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

const Videos = ({
  projectData,
  handleSubmit,
  mode,
  handleDelete,
  disabled,
}) => {
  const maxUploadFiles = 4;
  const [videos, setVideos] = useState([]);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (projectData?.id && projectData?.videos) {
      setVideos(projectData.videos);
    }
  }, [projectData, mode]);

  const getVideoThumbnail = useCallback((file, signal) => {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);

      const video = document.createElement('video');
      const objectURL = URL.createObjectURL(file);
      let cleanedUp = false;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleError);
        signal?.removeEventListener('abort', handleAbort);
        video.pause();
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectURL);
      };

      const resolveThumbnail = (thumbnail) => {
        if (cleanedUp) return;
        cleanup();
        resolve(thumbnail);
      };

      const rejectThumbnail = (error) => {
        if (cleanedUp) return;
        cleanup();
        reject(error);
      };

      const captureFrame = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          rejectThumbnail(new Error('Canvas not available'));
          return;
        }
        const context = canvas.getContext('2d');
        if (!context || !video.videoWidth || !video.videoHeight) {
          rejectThumbnail(new Error('Video frame is unavailable'));
          return;
        }

        const maxDimension = 640;
        const scale = Math.min(
          1,
          maxDimension / Math.max(video.videoWidth, video.videoHeight)
        );
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolveThumbnail(blob);
            else
              rejectThumbnail(
                new Error('Video thumbnail could not be created')
              );
          },
          'image/jpeg',
          0.75
        );
      };

      const handleLoadedData = () => {
        const targetTime = Number.isFinite(video.duration)
          ? Math.min(1, video.duration / 2)
          : 0;
        if (targetTime > 0.05) video.currentTime = targetTime;
        else captureFrame();
      };

      const handleSeeked = () => captureFrame();

      const handleError = (err) => {
        rejectThumbnail(
          err instanceof Error ? err : new Error('Video could not be decoded')
        );
      };

      const handleAbort = () => {
        rejectThumbnail(
          new DOMException('Video thumbnail generation aborted', 'AbortError')
        );
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('error', handleError);
      signal?.addEventListener('abort', handleAbort, { once: true });

      if (signal?.aborted) {
        handleAbort();
        return;
      }

      video.src = objectURL;
      video.load();
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (uploadedVideos.length > 0) {
      const latestVideo = uploadedVideos[uploadedVideos.length - 1];
      getVideoThumbnail(latestVideo, controller.signal)
        .then((thumbnail) => {
          setVideoThumbnail(thumbnail);
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') setVideoThumbnail(null);
        });
    } else {
      setVideoThumbnail(null);
    }

    return () => controller.abort();
  }, [getVideoThumbnail, uploadedVideos]);

  const handleAddVideos = async () => {
    if (uploadedVideos.length < 1) return;

    if (await handleSubmit({ videos: uploadedVideos }, 'videos')) {
      setUploadedVideos([]);
      setVideoThumbnail(null);
    }
  };

  const handleRemoveVideo = (contentId) => {
    if (contentId) {
      handleDelete('videos', contentId).then((deleted) => {
        if (deleted) {
          setVideos((currentVideos) =>
            currentVideos.filter((video) => video.id !== contentId)
          );
        }
      });
    }
  };

  const togglePlayPause = (key) => {
    setPlayingVideo((currentKey) => (currentKey === key ? null : key));
  };

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 col-span-10 lg:col-span-5'>
      <div className='grid gap-9'>
        <div className='grid grid-cols-[1fr_auto] gap-7'>
          <div className='flex w-full gap-3 h-full justify-start items-start'>
            <h3 className='text-primary-main font-medium opacity-90 text-sm h-min'>
              Videos
            </h3>
            <div className='h-[170px] w-full'>
              <ImgFileUploader
                disabled={disabled}
                dataURL={true}
                dragActiveText={'Drop Videos here!'}
                fileImg={videoThumbnail}
                onLoad={(file) => {
                  setUploadedVideos((currentFiles) =>
                    currentFiles.length < maxUploadFiles
                      ? [...currentFiles, file]
                      : currentFiles
                  );
                }}
                clearFileImg={() => {
                  setUploadedVideos([]);
                  setVideoThumbnail(null);
                }}
                PlaceholderImgIcon={MdOutlineOndemandVideo}
                video={true}
                fileNumber={uploadedVideos?.length}
                currentFileCount={uploadedVideos.length}
                maxFiles={maxUploadFiles}
                placeholderIconClass='text-4xl!'
              />
            </div>
          </div>

          <div className='flex w-full h-full items-end justify-end'>
            <PrimaryButton
              disabled={disabled || uploadedVideos.length < 1}
              state='small'
              text={mode === 'create' ? 'ADD' : 'SAVE'}
              Icon={IoMdAdd}
              classes='rounded-full!'
              onClick={handleAddVideos}
            />
          </div>
        </div>

        {videos.length > 0 && (
          <div className='flex items-center flex-wrap flex-row gap-3'>
            {videos.map((item, key) => {
              const videoKey = item.id || key;
              return (
                <VideoPreview
                  key={videoKey}
                  index={key}
                  isPlaying={playingVideo === videoKey}
                  item={item}
                  onRemove={handleRemoveVideo}
                  onToggle={() => togglePlayPause(videoKey)}
                  disabled={disabled}
                />
              );
            })}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

Videos.propTypes = {
  projectData: PropTypes.shape({
    id: PropTypes.number,
    videos: PropTypes.array,
  }),
  handleSubmit: PropTypes.func,
  mode: PropTypes.string,
  handleDelete: PropTypes.func,
  disabled: PropTypes.bool,
};

export default Videos;
