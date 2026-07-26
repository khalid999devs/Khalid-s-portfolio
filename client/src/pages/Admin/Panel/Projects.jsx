import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import ProjectCard, {
  ProjectCardPreview,
} from '../../../components/Admin/Projects/ProjectCard.jsx';
import { deleteProject, reorderProjects } from '../../../axios/projects.js';
import Popup from '../../../components/utils/Popup.jsx';
import { reqFileWrapper, reqs } from '../../../axios/requests.js';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import ProjectDeleteDialog from '../../../components/Admin/Projects/ProjectDeleteDialog.jsx';

const Projects = () => {
  const { setPageTitle } = useOutletContext();
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [fetchState, setFetchState] = useState('loading');
  const reorderInFlightRef = useRef(false);

  const [popUp, setPopup] = useState({
    text: '',
    type: 'normal',
    state: false,
  });
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeleteProject = (projectId, projectName) => {
    if (loading) return;
    setDeleteTarget({ id: projectId, name: projectName });
  };

  const confirmDeleteProject = ({ id: projectId }) => {
    deleteProject(projectId, setLoading)
      .then((data) => {
        setDeleteTarget(null);
        setPopup({
          text: data.msg,
          type: 'success',
          state: true,
        });
        setProjects((projects) =>
          projects.filter((item) => item.id !== projectId)
        );
      })
      .catch((error) => {
        setDeleteTarget(null);
        setPopup({
          text: error.msg || 'Something went wrong, please try again.',
          type: 'error',
          state: true,
        });
      });
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over || active.id === over.id || reorderInFlightRef.current) {
      return;
    }

    const oldIndex = projects.findIndex((item) => item.id === active.id);
    const newIndex = projects.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newItems = arrayMove(projects, oldIndex, newIndex).map(
      (item, index) => ({ ...item, displayOrder: index })
    );
    const updatedOrders = newItems.map(({ id, displayOrder }) => ({
      id,
      displayOrder,
    }));

    reorderInFlightRef.current = true;
    setProjects(newItems);
    reorderProjects(updatedOrders)
      .catch((error) => {
        setPopup({
          text: error.msg || 'Failed to reorder projects.',
          type: 'error',
          state: true,
        });
        return axios.post(reqs.GET_PROJECT, { mode: 'all' }).then((res) => {
          if (res.data.succeed) setProjects(res.data.result);
        });
      })
      .catch(() => {
        setProjects(projects);
      })
      .finally(() => {
        reorderInFlightRef.current = false;
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    setPageTitle('All Projects');
    axios
      .post(
        reqs.GET_PROJECT,
        { mode: 'all' },
        { signal: controller.signal }
      )
      .then((res) => {
        if (res.data.succeed) {
          setProjects(res.data.result);
          setFetchState('ready');
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setFetchState('error');
        setPopup({
          text: error.response?.data?.msg || 'Failed to load projects.',
          type: 'error',
          state: true,
        });
      });

    return () => controller.abort();
  }, [setPageTitle]);

  const activeProject = projects.find((project) => project.id === activeId);

  return (
    <div className='flex flex-col gap-5'>
      {fetchState === 'loading' && (
        <p role='status' className='text-muted-light'>
          Loading projects…
        </p>
      )}
      {fetchState === 'ready' && projects.length === 0 && (
        <p className='text-muted-light'>No projects have been created yet.</p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext
          items={projects.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className='flex flex-row flex-wrap gap-5'>
            {projects.map((item) => (
              <ProjectCard
                key={item.id}
                id={item.id}
                title={item.title}
                subtitle={item.subtitle}
                img={reqFileWrapper(item.thumbnailContents[0]?.url)}
                value={item.value}
                handleDeleteProject={handleDeleteProject}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeId && activeProject ? (
            <div className='opacity-90 scale-105 shadow-2xl transition-all duration-150'>
              <ProjectCardPreview
                id={activeProject.id}
                title={activeProject.title}
                subtitle={activeProject.subtitle}
                img={reqFileWrapper(activeProject.thumbnailContents[0]?.url)}
                value={activeProject.value}
                handleDeleteProject={handleDeleteProject}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ProjectDeleteDialog
        busy={loading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteProject}
        project={deleteTarget}
      />

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

export default Projects;
