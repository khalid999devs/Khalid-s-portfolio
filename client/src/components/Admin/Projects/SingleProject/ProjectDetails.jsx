import { useEffect, useState } from 'react';
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
import PropTypes from 'prop-types';

const ProjectDetails = ({ mode = 'create', projectId }) => {
  const location = useLocation();
  const navigate = useNavigate();
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
    const controller = new AbortController();
    axios
      .post(reqs.GET_PROJECT, { mode: 'cat' }, { signal: controller.signal })
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
        if (controller.signal.aborted) return;
        setPopup({
          text: err.response?.data?.msg || 'An error occurred',
          type: 'error',
          state: true,
        });
      });

    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    const controller = new AbortController();

    if (mode === 'edit') {
      axios
        .post(
          reqs.GET_PROJECT,
          { mode: 'single', projectId },
          { signal: controller.signal }
        )
        .then((res) => {
          if (res.data.succeed) {
            setProjectData(res.data.result);
          }
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setPopup({
            text: err.response?.data?.msg || 'An error occurred',
            type: 'error',
            state: true,
          });
        });
    }

    return () => controller.abort();
  }, [mode, projectId]);

  const handleDeleteProject = (projectId, projectName) => {
    if (mode === 'edit') {
      deleteProject(projectId, projectName, setLoading, setPopup)
        .then((data) => {
          if (data.cancelled) return;
          setPopup({
            text: data.msg,
            type: 'success',
            state: true,
          });
          navigate('/admin/projects', { replace: true });
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

  const handleCreateProject = async (data) => {
    if (!data.title || !data.subtitle || mode !== 'create' || loading) {
      return false;
    }

    setLoading(true);
    setPopup({ text: 'Creating project...', type: 'normal', state: true });

    try {
      const res = await axios.post(reqs.CREATE_PROJECT, data);
      if (!res.data.succeed) return false;

      const initInfos = res.data.initialInfos;
      navigate(
        `/admin/edit-project/${encodeURIComponent(initInfos.value)}?id=${
          initInfos.id
        }`,
        { replace: true, state: { formMode: 'content' } }
      );
      return true;
    } catch (err) {
      setPopup({
        text: err.response?.data?.msg || 'An error occurred',
        type: 'error',
        state: true,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };
  const handleUpdateProjectInfos = async (data) => {
    if (mode !== 'edit' || !projectData.id || loading) return false;

    setLoading(true);
    setPopup({ text: 'Updating...', type: 'normal', state: true });

    try {
      const res = await axios.patch(
        `${reqs.EDIT_PROJECT_INFOS}/${projectData.id}`,
        data
      );
      if (!res.data.succeed) return false;

      setProjectData((currentProject) => ({
        ...currentProject,
        ...res.data.result,
      }));
      setPopup({ text: res.data.msg, type: 'success', state: true });
      return true;
    } catch (err) {
      setPopup({
        text: err.response?.data?.msg || 'An error occurred',
        type: 'error',
        state: true,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleEditProjectContents = async (
    data, //{bannerImg:{},...}
    contentMode,
    contentId = null,
    replace = false
  ) => {
    if (!projectData?.id || loading) return false;

    const fd = new FormData();
    fd.append('mode', contentMode);
    fd.append('replaceItem', replace);
    if (contentId !== null && contentId !== undefined && contentId !== '') {
      fd.append('contentId', contentId);
    }
    if (projectData.title) fd.append('title', projectData.title);

    for (const field in data) {
      if (Array.isArray(data[field])) {
        data[field].forEach((item) => {
          fd.append(field, item);
        });
      } else {
        fd.append(field, data[field]);
      }
    }

    setLoading(true);
    setPopup({ text: 'Uploading...', type: 'normal', state: true });

    try {
      const res = await axios.patch(
        `${reqs.EDIT_PROJECT_CONTENTS}/${projectData.id}`,
        fd,
        { timeout: 120_000 }
      );
      if (!res?.data.succeed) return false;

      const result = res.data.result;
      if (result && Object.hasOwn(result, contentMode)) {
        setProjectData((currentProject) => ({
          ...currentProject,
          [contentMode]: result[contentMode],
        }));
      }
      setPopup({ text: res.data.msg, type: 'success', state: true });
      return true;
    } catch (err) {
      setPopup({
        text: err.response?.data?.msg || 'Something wrong happened!',
        type: 'error',
        state: true,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProjectContents = async (contentMode, contentId) => {
    if (!projectData?.id || loading) return false;

    setLoading(true);
    setPopup({
      text: 'Deleting...',
      type: 'normal',
      state: true,
    });
    try {
      const res = await axios.patch(
        `${reqs.DELETE_PROJECT_CONTENTS}/${projectData.id}`,
        { mode: contentMode, contentId }
      );
      if (!res.data.succeed) return false;

      setProjectData((currentProject) => {
        if (contentMode === 'bannerImg') {
          return { ...currentProject, bannerImg: null };
        }

        return {
          ...currentProject,
          [contentMode]: (currentProject[contentMode] || []).filter(
            (item) => String(item.id) !== String(contentId)
          ),
        };
      });
      setPopup({ text: res.data.msg, type: 'success', state: true });
      return true;
    } catch (err) {
      setPopup({
        text: err.response?.data?.msg || 'Something wrong happened!',
        type: 'error',
        state: true,
      });
      return false;
    } finally {
      setLoading(false);
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
        disabled={loading}
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
            disabled={loading}
          />
          <div className='w-full hidden lg:flex pt-10 items-start justify-center h-full col-span-3'>
            <img
              className='w-full h-auto'
              src={
                mode === 'create' ? newProjIllustration : editProjIllustration
              }
              alt={
                mode === 'create'
                  ? 'Create project illustration'
                  : 'Edit project illustration'
              }
            />
          </div>
        </div>
      ) : (
        <div className='w-full h-full grid grid-cols-10 gap-6'>
          <LinksAndTechs
            mode={mode}
            projectData={projectData}
            handleSubmitData={handleUpdateProjectInfos}
            disabled={loading}
          />
          <Banner
            projectData={projectData}
            handleSubmit={handleEditProjectContents}
            handleDelete={handleDeleteProjectContents}
            mode={mode}
            disabled={loading}
          />
          <Videos
            projectData={projectData}
            mode={mode}
            handleDelete={handleDeleteProjectContents}
            handleSubmit={handleEditProjectContents}
            disabled={loading}
          />
          <Thumbnails
            projectData={projectData}
            mode={mode}
            handleDelete={handleDeleteProjectContents}
            handleSubmit={handleEditProjectContents}
            disabled={loading}
          />
          <SliderContents
            projectData={projectData}
            mode={mode}
            handleDelete={handleDeleteProjectContents}
            handleSubmit={handleEditProjectContents}
            disabled={loading}
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

ProjectDetails.propTypes = {
  mode: PropTypes.string,
  projectId: PropTypes.number,
};

export default ProjectDetails;
