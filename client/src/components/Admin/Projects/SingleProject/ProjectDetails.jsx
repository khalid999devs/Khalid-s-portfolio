import React, { useEffect, useState } from 'react';
import { deleteProject } from '../../../../axios/projects';
import Popup from '../../../utils/Popup';
import ProgressAndDel from './ProgressAndDel';
import axios from 'axios';
import { reqs } from '../../../../axios/requests';
import ProjectTitles from './ProjectTitles';
import { editProjIllustration, newProjIllustration } from '../../../../assets';
import LinksAndTechs from '../ProjectContents/LinksAndTechs';
import Banner from '../ProjectContents/Banner';
import Videos from '../ProjectContents/Videos';
import Thumbnails from '../ProjectContents/Thumbnails';
import SliderContents from '../ProjectContents/SliderContents';
import { useLocation, useNavigate } from 'react-router-dom';

const ProjectDetails = ({ mode = 'create', projectId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locFormMode = location.state?.formMode;
  const [formMode, setFormMode] = useState(locFormMode || 'info'); //info||content
  const [projectData, setProjectData] = useState({
    id: null,
    title: '',
    subtitle: '',
    overview: '',
    role: [],
    category: '',
    date: '',
    locationYear: '',
    videos: [],
    thumbnailContents: [],
    sliderContents: [],
    bannerImg: null,
    techStack: [],
    siteLink: '',
    codeLink: '',
  });
  const [popUp, setPopup] = useState({
    text: '',
    type: 'normal',
    state: false,
  });
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (localStorage.getItem('project')) {
      const createdProjectInfo = JSON.parse(localStorage.getItem('project'));
      if (createdProjectInfo.value && createdProjectInfo.id) {
        localStorage.removeItem('project');
        navigate(
          `/admin/edit-project/${createdProjectInfo.value}?id=${createdProjectInfo.id}`,
          { replace: true, state: { formMode: 'content' } }
        );
      }
    }
    axios
      .post(reqs.GET_PROJECT, { mode: 'cat' })
      .then((res) => {
        if (res.data.succeed) {
          setCategories(res.data.result);
        } else {
          setPopup({
            text: res.data.msg,
            type: 'error',
            state: true,
          });
        }
      })
      .catch((err) => {
        setPopup({
          text: err.response.data.msg,
          type: 'error',
          state: true,
        });
      });
  }, []);

  useEffect(() => {
    if (mode === 'edit') {
      axios
        .post(reqs.GET_PROJECT, { mode: 'single', projectId })
        .then((res) => {
          if (res.data.succeed) {
            setProjectData(res.data.result);
          }
        })
        .catch((err) => {
          setPopup({ text: err.response.data.msg, type: 'error', state: true });
        });
    }
  }, [mode]);

  const handleDeleteProject = (projectId, projectName) => {
    if (mode === 'edit') {
      deleteProject(projectId, projectName, setLoading, setPopup)
        .then((data) => {
          setPopup({
            text: data.msg,
            type: 'success',
            state: true,
          });
        })
        .catch((error) => {
          setPopup({
            text: error.msg || 'Something went wrong, please try again.',
            type: 'error',
            state: true,
          });
        });
    }
  };

  const handleCreateProject = (data) => {
    if (data.title && data.subtitle && mode === 'create') {
      setLoading(true);
      setPopup({
        text: 'Loading...',
        type: 'normal',
        state: true,
      });
      axios
        .post(reqs.CREATE_PROJECT, data, { withCredentials: true })
        .then((res) => {
          setLoading(false);
          if (res.data.succeed) {
            const initInfos = res.data.initialInfos;
            setProjectData((projectData) => ({
              ...projectData,
              ...initInfos,
            }));
            setPopup({
              text: res.data.msg,
              type: 'success',
              state: true,
            });
            localStorage.setItem(
              'project',
              JSON.stringify({ id: initInfos.id, value: initInfos.value })
            );
            setFormMode('content');
          }
        })
        .catch((err) => {
          setLoading(false);
          setPopup({
            text: err.response.data.msg,
            type: 'error',
            state: true,
          });
        });
    }
  };
  const handleUpdateProjectInfos = (data) => {
    if (projectData.title && projectData.subtitle && mode === 'edit') {
      setLoading(true);
      setPopup({
        text: 'Updating...',
        type: 'normal',
        state: true,
      });
      axios
        .patch(`${reqs.EDIT_PROJECT_INFOS}/${projectData.id}`, data, {
          withCredentials: true,
        })
        .then((res) => {
          setLoading(false);
          if (res.data.succeed) {
            setProjectData((projectData) => ({
              ...projectData,
              ...res.data.result,
            }));
            setPopup({
              text: res.data.msg,
              type: 'success',
              state: true,
            });
          }
        })
        .catch((err) => {
          setLoading(false);
          setPopup({
            text: err.response.data.msg,
            type: 'error',
            state: true,
          });
        });
    }
  };

  const handleUpdateProjectContents = (data) => {
    if (mode === 'create' && projectData.id) {
      setLoading(true);
      setPopup({
        text: 'Loading...',
        type: 'normal',
        state: true,
      });
      axios
        .put(`${reqs.UPDATE_PROJECT_CONTENT}/${projectData.id}`, data, {
          withCredentials: true,
        })
        .then((res) => {
          setLoading(false);
          if (res.data.succeed) {
            setProjectData((projectData) => ({
              ...projectData,
              ...res.data.result,
            }));
            setPopup({
              text: res.data.msg,
              type: 'success',
              state: true,
            });
          }
        })
        .catch((err) => {
          setLoading(false);
          setPopup({
            text: err.response.data.msg || 'Something wrong happened!',
            type: 'error',
            state: true,
          });
        });
    }
  };

  const handleEditProjectContents = (
    data, //{bannerImg:{},...}
    contentMode,
    contentId = null,
    replace = false
  ) => {
    if (projectData?.id) {
      const fd = new FormData();
      fd.append('mode', contentMode);
      fd.append('contentId', contentId);
      fd.append('replaceItem', replace);
      fd.append('title', projectData.title || projectData.id);

      for (let i in data) {
        if (Array.isArray(data[i])) {
          data[i].forEach((item) => {
            fd.append(i, item);
          });
        } else {
          fd.append(i, data[i]);
        }
      }

      // for (const entry of fd.entries()) {
      //   console.log(entry);
      // }

      setLoading(true);
      setPopup({
        text: 'Uploading...',
        type: 'normal',
        state: true,
      });
      axios
        .patch(`${reqs.EDIT_PROJECT_CONTENTS}/${projectData.id}`, fd, {
          withCredentials: true,
        })
        .then((res) => {
          setLoading(false);
          if (res?.data.succeed) {
            setPopup({
              text: res.data.msg,
              type: 'success',
              state: true,
            });
            const result = res.data.result;

            setProjectData((projectData) => ({
              ...projectData,
              videos: result?.videos,
              sliderContents: result?.sliderContents,
              thumbnailContents: result?.thumbnailContents,
            }));
          }
        })
        .catch((err) => {
          setLoading(false);
          setPopup({
            text: err.response.data.msg || 'Something wrong happened!',
            type: 'error',
            state: true,
          });
        });
    }
  };

  const handleDeleteProjectContents = (contentMode, contentId) => {
    if (projectData?.id) {
      setLoading(true);
      setPopup({
        text: 'Deleting...',
        type: 'normal',
        state: true,
      });
      axios
        .patch(
          `${reqs.DELETE_PROJECT_CONTENTS}/${projectData.id}`,
          { mode: contentMode, contentId },
          {
            withCredentials: true,
          }
        )
        .then((res) => {
          setLoading(false);
          if (res.data.succeed) {
            setPopup({
              text: res.data.msg,
              type: 'success',
              state: true,
            });
          }
        })
        .catch((err) => {
          setLoading(false);
          setPopup({
            text: err.response.data.msg || 'Something wrong happened!',
            type: 'error',
            state: true,
          });
        });
    }
  };

  return (
    <div className='w-full h-full grid gap-6 pb-20'>
      <ProgressAndDel
        handleDelete={handleDeleteProject}
        mode={mode}
        formMode={formMode}
        setFormMode={setFormMode}
        projectId={projectData?.id}
        projectName={projectData?.title}
      />
      {formMode === 'info' ? (
        <div className='w-full h-full grid grid-cols-10 gap-6'>
          <ProjectTitles
            handleCreateProject={handleCreateProject}
            mode={mode}
            categories={categories}
            setFormMode={setFormMode}
            projectData={projectData}
            handleUpdateProjectInfos={handleUpdateProjectInfos}
          />
          <div className='w-full hidden lg:flex pt-10 items-start justify-center h-full col-span-3'>
            <img
              className='w-full h-auto'
              src={
                mode === 'create' ? newProjIllustration : editProjIllustration
              }
              alt='project-create-img'
            />
          </div>
        </div>
      ) : (
        <div className='w-full h-full grid grid-cols-10 gap-6'>
          <LinksAndTechs
            mode={mode}
            projectData={projectData}
            handleSubmitData={(data) => {
              mode === 'create'
                ? handleUpdateProjectContents(data)
                : handleUpdateProjectInfos(data);
            }}
          />
          <Banner
            projectData={projectData}
            handleSubmit={handleEditProjectContents}
            handleDelete={handleDeleteProjectContents}
            mode={mode}
          />
          <Videos
            projectData={projectData}
            mode={mode}
            handleDelete={handleDeleteProjectContents}
            handleSubmit={handleEditProjectContents}
          />
          <Thumbnails
            projectData={projectData}
            mode={mode}
            handleDelete={handleDeleteProjectContents}
            handleSubmit={handleEditProjectContents}
          />
          <SliderContents
            projectData={projectData}
            mode={mode}
            handleDelete={handleDeleteProjectContents}
            handleSubmit={handleEditProjectContents}
          />
        </div>
      )}

      <Popup
        setPopup={setPopup}
        state={popUp.state}
        loading={loading}
        text={popUp.text}
        type={popUp.type}
      />
    </div>
  );
};

export default ProjectDetails;
