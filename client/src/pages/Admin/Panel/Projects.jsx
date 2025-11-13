import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import ProjectCard from '../../../components/Admin/Projects/ProjectCard.jsx';
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

const Projects = () => {
  const { setPageTitle } = useOutletContext();
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const [popUp, setPopup] = useState({
    text: '',
    type: 'normal',
    state: false,
  });
  const [loading, setLoading] = useState(false);

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
    deleteProject(projectId, projectName, setLoading, setPopup)
      .then((data) => {
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

    if (!over || active.id === over.id) {
      return;
    }

    setProjects((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);

      // Update displayOrder for all projects
      const updatedOrders = newItems.map((item, index) => ({
        id: item.id,
        displayOrder: index,
      }));

      // Call API to save new order
      reorderProjects(updatedOrders)
        .then(() => {
          // Success - no popup needed
        })
        .catch((error) => {
          setPopup({
            text: error.msg || 'Failed to reorder projects.',
            type: 'error',
            state: true,
          });
          // Refetch projects to restore original order on error
          axios
            .post(reqs.GET_PROJECT, { mode: 'all' })
            .then((res) => {
              if (res.data.succeed) setProjects(res.data.result);
            })
            .catch(() => {
              // Error handled silently
            });
        });

      return newItems;
    });
  };

  useEffect(() => {
    setPageTitle('All Projects');
    axios
      .post(reqs.GET_PROJECT, { mode: 'all' })
      .then((res) => {
        if (res.data.succeed) setProjects(res.data.result);
      })
      .catch(() => {
        // Error handled silently
      });
  }, [setPageTitle]);

  const activeProject = projects.find((project) => project.id === activeId);

  return (
    <div className='flex flex-col gap-5'>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
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
              <ProjectCard
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
