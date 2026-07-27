import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { MdAddCircleOutline } from 'react-icons/md';
import axios from 'axios';
import ProjectCard from '../../../components/Admin/Projects/ProjectCard';
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
  const { setPageTitle, searchTerm } = useOutletContext();
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const [popUp, setPopup] = useState({
    text: '',
    type: 'normal',
    state: false,
  });
  const [loading, setLoading] = useState(false);

  /**
   * Filtered client side, because the whole catalogue is already loaded and is
   * three rows. A server side search would be a round trip per keystroke for a
   * list that fits on one screen.
   *
   * Dragging is disabled while a search is active: reordering a filtered list
   * would write positions computed from a subset, silently reshuffling the
   * projects that were hidden at the time.
   */
  const isSearching = Boolean(searchTerm && searchTerm.trim());
  const visibleProjects = isSearching
    ? projects.filter((project) => {
        const needle = searchTerm.trim().toLowerCase();
        return [project.title, project.subtitle, project.value]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle));
      })
    : projects;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Effectively disables dragging while filtering: an unreachable
        // threshold is simpler and less fragile than conditionally swapping
        // the sensor set, which react-dnd does not expect to change.
        distance: isSearching ? Number.MAX_SAFE_INTEGER : 5,
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
      {isSearching && (
        <p className='text-secondary-light text-sm mb-4'>
          {visibleProjects.length === 0
            ? `Nothing matches "${searchTerm}".`
            : `${visibleProjects.length} of ${projects.length} projects match "${searchTerm}".`}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleProjects.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className='flex flex-row flex-wrap gap-5'>
            {/*
              An empty state, not a permanent control. The sidebar already has
              an Add Project link, so a tile that sits there forever is a second
              copy of it taking up a card slot. It earns its place only when
              there is nothing else to show.
            */}
            {!isSearching && projects.length === 0 && (
              <Link
                to='/admin/add-project'
                className='w-[280px] min-h-[300px] rounded-xl border border-dashed border-secondary-main/50 grid place-items-center gap-2 text-secondary-light transition-all duration-300 hover:border-onPrimary-main hover:text-primary-main'
              >
                <div className='grid place-items-center gap-2'>
                  <MdAddCircleOutline className='text-3xl' />
                  <span className='text-sm'>Add a project</span>
                </div>
              </Link>
            )}

            {visibleProjects.map((item) => (
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
