import React, { useEffect, useState, useRef } from 'react';
import ImgFileUploader from '../../../utils/ImgFileUploader';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { IoMdAdd } from 'react-icons/io';
import { MdOutlineOndemandVideo } from 'react-icons/md';
import { reqFileWrapper } from '../../../../axios/requests';
import { FaPlay, FaPause } from 'react-icons/fa';
import { FaVideo } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';

const Videos = ({ projectData, handleSubmit, mode, handleDelete }) => {
  const [videos, setVideos] = useState([]);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (projectData?.id && projectData?.videos) {
      // const loadThumbnails = async () => {
      //   const updatedVideos = await Promise.all(
      //     projectData.videos.map(async (item) => {
      //       const thumbnail = await getVideoThumbnail(reqFileWrapper(item.url));
      //       return { ...item, thumbnail };
      //     })
      //   );
      //   setVideos(updatedVideos);
      // };
      // loadThumbnails();

      setVideos(projectData.videos);
    }
  }, [projectData, mode]);

  const getVideoThumbnail = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);

      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      video.addEventListener('loadeddata', () => {
        video.currentTime = 2;
      });

      video.addEventListener('seeked', () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailDataURL = canvas.toDataURL('image/png');
        resolve(thumbnailDataURL);
        URL.revokeObjectURL(video.src);
      });

      video.addEventListener('error', (err) => {
        reject(err);
      });
    });
  };

  useEffect(() => {
    if (uploadedVideos.length > 0) {
      const latestVideo = uploadedVideos[uploadedVideos.length - 1];
      getVideoThumbnail(latestVideo).then((thumbnailURL) => {
        setVideoThumbnail(thumbnailURL);
      });
    }
  }, [uploadedVideos]);

  const handleAddVideos = async () => {
    // const newVideosWithThumbnails = await Promise.all(
    //   uploadedVideos.map(async (item) => {
    //     const thumbnail = await getVideoThumbnail(item);
    //     return { file: item, thumbnail };
    //   })
    // );
    if (uploadedVideos.length < 1) {
      alert('Please Add a video first!');
      return;
    }
    // setVideos((prevVideos) => [...prevVideos, ...uploadedVideos]);
    handleSubmit({ videos: uploadedVideos }, 'videos');
    setUploadedVideos([]);
    setVideoThumbnail(null);
  };

  const handleRemoveVideo = (contentId) => {
    if (contentId) {
      handleDelete('videos', contentId);
      setVideos((videos) => [
        ...videos.filter((video) => video.id !== contentId),
      ]);
    }
  };

  const togglePlayPause = (key) => {
    const currentVideo = document.getElementById(`video-${key}`);
    if (!currentVideo) return;

    if (playingVideo === key) {
      currentVideo.pause();
      setPlayingVideo(null);
    } else {
      if (playingVideo !== null) {
        const previousVideo = document.getElementById(`video-${playingVideo}`);
        if (previousVideo) previousVideo.pause();
      }
      currentVideo.play();
      setPlayingVideo(key);
    }
  };

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 col-span-10 lg:col-span-5'>
      <div className='grid gap-9'>
        <div className='grid grid-cols-[1fr,auto] gap-7'>
          <div className='flex w-full gap-3 h-full justify-start items-start'>
            <h3 className='text-primary-main font-medium opacity-90 text-sm h-min'>
              Videos
            </h3>
            <div className='h-[170px] w-full'>
              <ImgFileUploader
                dataURL={true}
                dragActiveText={'Drop Videos here!'}
                fileImg={videoThumbnail}
                onLoad={(file) => {
                  setUploadedVideos((prev) => [...prev, file]);
                }}
                mode={mode}
                clearFileImg={() => {
                  setUploadedVideos([]);
                  setVideoThumbnail(null);
                }}
                PlaceholderImgIcon={MdOutlineOndemandVideo}
                video={true}
                fileNumber={uploadedVideos?.length}
                plaecholderIconCls={`!text-4xl`}
              />
            </div>
          </div>

          <div className='flex w-full h-full items-end justify-end'>
            <PrimaryButton
              state='small'
              text={mode === 'create' ? 'ADD' : 'SAVE'}
              Icon={IoMdAdd}
              classes={`!rounded-full`}
              onClick={handleAddVideos}
            />
          </div>
        </div>

        {videos.length > 0 && (
          <div className='flex items-center flex-wrap flex-row gap-3'>
            {videos.map((item, key) => (
              <div
                key={key}
                className='w-[128px] h-[100px] bg-black rounded-lg relative overflow-hidden group'
                onClick={() => togglePlayPause(key)}
              >
                <video
                  id={`video-${key}`}
                  src={
                    !item.url
                      ? URL.createObjectURL(item)
                      : reqFileWrapper(item.url)
                  }
                  playsInline
                  preload='metadata'
                  muted={playingVideo !== key}
                  className='w-full h-full object-cover'
                ></video>
                <div
                  className='absolute text-xl text-primary-main top-1/2 left-1/2'
                  style={{ transform: 'translate(-50%,-50%)' }}
                >
                  {playingVideo === key ? <FaPause /> : <FaPlay />}
                </div>
                <div
                  className='absolute right-[3%] top-[3%] bg-body-main bg-opacity-70 text-sm duration-500 group-hover:bg-opacity-100 w-[22px] h-[22px] rounded-full flex items-center justify-center cursor-pointer'
                  onClick={(e) => {
                    e.preventDefault();
                    item.id && handleRemoveVideo(item.id);
                  }}
                >
                  <IoClose className='text-primary-main' />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default Videos;
