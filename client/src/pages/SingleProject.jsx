import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { reqFileWrapper, reqs } from '../axios/requests';
import { loadingGif, projectPlaceholder } from '../assets';
import { BsFillCaretRightFill } from 'react-icons/bs';
import { FaGithub } from 'react-icons/fa';

import TextDividerHeading from '../components/project/TextDividerHeading';
import LiveProjectButton from '../components/project/LiveProjectButton';
import {
  OutlinedBigIcon,
  OutlinedSmallButton,
} from '../components/Buttons/OutlinedButton';
import ProjectVideos from './Project/projectVideos';
import { useAppContext } from '../App';
import HRLine from '../components/utils/HRLine';
import useTextRevealAnimation from '../animations/useTextRevealAnimation';
import Loader from '../components/utils/Loader';
import { wordBlinkAnimation } from '../animations/wordBlinkAnimation';
import PageTransition from '../animations/PageTransition';
import ProjectSlider from '../components/project/ProjectSlider';
import FloatingActionBtn from '../components/utils/FloatingActionBtn';
import MetaCard from '../components/utils/MetaCard';

const SingleProject = () => {
  const navigate = useNavigate();
  const loc = useLocation();
  const {
    appData: { projects },
  } = useAppContext();
  const { value } = useParams();
  const [project, setProject] = useState({});
  const [projLoading, setProjLoading] = useState(false);
  const [nextProject, setNextProject] = useState({});
  useTextRevealAnimation('project-text-reveal');
  const projectDescParent = useRef(null);
  const projectDesc = useRef(null);

  const findProjectAndgetNext = () => {
    const numberOfProjects = projects?.length;
    if (numberOfProjects && numberOfProjects > 1 && project?.value) {
      const currKey = projects.findIndex(
        (item) => item.value === project.value
      );

      if (currKey + 1 >= numberOfProjects) {
        setNextProject(projects[0]);
      } else {
        setNextProject(projects[currKey + 1]);
      }
    }
  };

  useEffect(() => {
    findProjectAndgetNext();
  }, [project, projects]);

  useEffect(() => {
    window.scrollTo({
      left: 0,
      top: 0,
    });
  }, [loc.pathname, project]);

  useEffect(() => {
    const spArr = value.split('@');
    const projectId = spArr[spArr.length - 1];
    setProjLoading(true);
    axios
      .post(reqs.GET_PROJECT, { mode: 'single', projectId })
      .then((res) => {
        if (res.data.succeed) {
          setProject(res.data.result);
        }
        setProjLoading(false);
      })
      .catch((err) => {
        // console.log(err);
        setProjLoading(false);
        navigate('/error');
      });
  }, [value]);

  useEffect(() => {
    if (projectDescParent.current && projectDesc.current) {
      wordBlinkAnimation(
        projectDesc.current,
        null,
        projectDescParent.current,
        true,
        true,
        6
      );
    }
  }, [project]);

  if (projLoading) {
    return <Loader classes={'min-h-[250px]'} />;
  }

  return (
    <div className='w-full pb-28 flex flex-col gap-20 lg:gap-24 min-h-screen screen-max-width pt-[160px]'>
      <MetaCard
        title={project?.title}
        description={project?.overview}
        image={
          project.thumbnailContents && project.thumbnailContents.length
            ? reqFileWrapper(project.thumbnailContents[0].url)
            : reqFileWrapper(project?.bannerImg)
        }
      />

      {projLoading && (
        <div className='w-full min-h-[400px] flex items-center justify-center'>
          <img
            src={loadingGif}
            alt='Loading...'
            className='max-w-[90px] h-auto'
          />
        </div>
      )}

      {(project?.siteLink || project?.designLink) && (
        <FloatingActionBtn
          siteLink={project.siteLink}
          designLink={project.designLink}
        />
      )}

      <div className='flex w-full flex-col gap-20 sec-project-x-padding'>
        <div className='flex flex-col w-full md:justify-start '>
          <h4 className='text-[12px] sm:text-sm text-montreal-mono text-onPrimary-main '>
            {project.subtitle}
          </h4>

          {project.title && (
            <h1 className='text-[2.5rem] sm:text-[3rem] md:text-[4rem] uppercase break-words text-left text-letter-reveal pointer-all'>
              {project.title}
            </h1>
          )}
        </div>

        <div className='flex flex-row justify-start lg:justify-between items-start flex-wrap gap-10 sm:gap-14 lg:gap-6'>
          <TextDividerHeading
            role='ROLE/SERVICES'
            text={project?.role?.join(' — ')}
          />

          <TextDividerHeading
            role='CODE LINK'
            text={
              <div
                className='flex items-center gap-3 group uppercase cursor-pointer'
                onClick={() => {
                  window.open(
                    project.codeLink || 'https://github.com/khalid999devs',
                    '_blank'
                  );
                }}
              >
                <span className='group-hover:underline'>GITHUB</span>
                <FaGithub className='text-white text-lg' />
              </div>
            }
          />

          <TextDividerHeading
            role='LOCATION & YEAR'
            text={project?.locationYear}
          />
        </div>
      </div>

      <div className='w-full h-auto sec-x-padding relative'>
        {project.siteLink && <LiveProjectButton link={project.siteLink} />}
        <img
          src={
            project.bannerImg
              ? reqFileWrapper(project.bannerImg)
              : projectPlaceholder
          }
          className='w-full min-h-[200px] max-h-[300px] md:max-h-[400px] object-cover h-auto pointer-all'
          alt='BannerImg'
        />
      </div>

      <div
        ref={projectDescParent}
        className='flex w-full flex-col md:flex-row justify-between items-start gap-16 md:gap-24 sec-project-x-padding pointer-all'
      >
        {project.overview && (
          <div ref={projectDesc} className='text-secondary-light flex-1 w-full'>
            {project?.overview}
          </div>
        )}

        <div className='flex-1 flex flex-col gap-3 w-full'>
          <div className='flex items-center gap-1 pt-1'>
            <span className='text-xs sm:text-sm text-secondary-main opacity-80 uppercase text-letter-reveal'>
              # TECH STACK
            </span>
            <BsFillCaretRightFill className='text-secondary-main text-xs' />
          </div>
          <div className='flex flex-row flex-wrap gap-x-2 gap-y-3'>
            {project?.techStack?.map((prop, i) => (
              <OutlinedSmallButton
                disableHover={true}
                key={i}
                text={prop}
                classes={`uppercase`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* project video / gif */}
      {project?.videos?.length > 0 && (
        <ProjectVideos videos={project?.videos} />
      )}

      {/* projects slider */}
      {project.sliderContents && project.sliderContents.length ? (
        <ProjectSlider sliderContents={project.sliderContents} />
      ) : null}

      {/* projects tabs */}
      {projects?.length > 1 && nextProject?.value && (
        <>
          <HRLine />

          <div className='relative w-full sec-project-x-padding flex flex-col gap-3.5 justify-center items-center'>
            <div className='text-secondary-light text-sm'>Next Project</div>
            <h2 className='text-4xl '>{nextProject.title}</h2>

            <div className='w-full overflow-hidden h-auto border-b-[0.5] border-secondary-main border-b border-opacity-40'>
              <div
                className='bg-primary-dark mt-4 rounded-t-md max-h-[90px] max-w-[200px] w-full p-3 pb-0 overflow-hidden m-auto translate-y-2 transition-transform duration-300 cursor-pointer pointer-all hover:translate-y-0'
                onClick={() => {
                  navigate(
                    `/singleProject/${
                      nextProject?.value + '@' + nextProject?.id
                    }`
                  );
                }}
              >
                <div className='rounded-t-lg '>
                  <img
                    src={reqFileWrapper(
                      nextProject?.thumbnailContents[0]?.url ||
                        nextProject?.bannerImg
                    )}
                    alt='next project image'
                    className='rounded-t-lg h-full'
                  />
                </div>
              </div>
              {/* <HRLine classes={`!my-0`} /> */}
            </div>

            <div className='mt-10'>
              <OutlinedBigIcon
                text={'All works'}
                onClick={() => {
                  navigate('/projects');
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PageTransition(SingleProject);
