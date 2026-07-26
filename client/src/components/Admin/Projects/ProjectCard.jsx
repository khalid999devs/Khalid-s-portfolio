import { MdOutlineDelete } from 'react-icons/md';
import { MdDragIndicator } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import RoundedIconBtn from '../../Buttons/RoundedIconBtn';
import PrimaryButton from '../../Buttons/PrimaryButton';
import { projectPlaceholder } from '../../../assets';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ProjectCardContent = ({
  articleRef,
  articleStyle,
  dragAttributes,
  dragListeners,
  showDragHandle = true,
  id,
  title,
  subtitle,
  img,
  value = 'project-val',
  handleDeleteProject,
}) => {
  const navigate = useNavigate();

  return (
    <article
      ref={articleRef}
      style={articleStyle}
      className='min-h-[300px] max-w-[312px] w-full bg-primary-dark rounded-xl box-big-shadow px-2 pt-3 pb-3.5 flex flex-col'
    >
      <div className='relative rounded-lg overflow-hidden w-full h-[190px] bg-white shrink-0'>
        <img
          src={img || projectPlaceholder}
          className='w-full h-full object-cover'
          alt={`${title || 'Untitled project'} thumbnail`}
        />
        <div className='absolute right-3 top-3 flex gap-2 items-center'>
          <RoundedIconBtn
            onClick={() => navigate(`/admin/edit-project/${value}?id=${id}`)}
            classes='hover:bg-green-800!'
            label={`Edit ${title || 'project'}`}
          />
          <RoundedIconBtn
            onClick={() => handleDeleteProject(id, title)}
            Icon={MdOutlineDelete}
            classes='hover:bg-red-700!'
            label={`Delete ${title || 'project'}`}
          />
        </div>
        {showDragHandle && (
          <button
            type='button'
            {...dragAttributes}
            {...dragListeners}
            aria-label={`Reorder ${title || 'project'}`}
            className='absolute left-3 top-3 bg-black/60 backdrop-blur-xs rounded-lg p-2 cursor-grab active:cursor-grabbing hover:bg-black/80 transition-all duration-200 hover:scale-110'
            style={{ touchAction: 'none' }}
            title='Drag to reorder'
          >
            <MdDragIndicator aria-hidden='true' className='text-white text-xl' />
          </button>
        )}
      </div>
      <div className='px-3.5 flex-1 flex flex-col justify-between pt-5'>
        <div className='grid gap-3'>
          <h2 className='text-xl line-clamp-2 leading-tight'>
            {title || 'Project Title'}
          </h2>
          <p className='text-sm text-montreal-mono text-muted-dark line-clamp-1'>
            {subtitle || 'Project Subtitle'}
          </p>
        </div>

        <PrimaryButton
          classes='text-sm! w-full rounded-full! mt-5 mb-0.5'
          text={'Details'}
          onClick={() => navigate(`/admin/edit-project/${value}?id=${id}`)}
        />
      </div>
    </article>
  );
};

ProjectCardContent.propTypes = {
  articleRef: PropTypes.func,
  articleStyle: PropTypes.object,
  dragAttributes: PropTypes.object,
  dragListeners: PropTypes.object,
  showDragHandle: PropTypes.bool,
  id: PropTypes.number.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  img: PropTypes.string,
  value: PropTypes.string,
  handleDeleteProject: PropTypes.func.isRequired,
};

const projectCardProps = {
  id: PropTypes.number.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  img: PropTypes.string,
  value: PropTypes.string,
  handleDeleteProject: PropTypes.func.isRequired,
};

const ProjectCard = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  return (
    <ProjectCardContent
      {...props}
      articleRef={setNodeRef}
      articleStyle={{
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms ease',
        opacity: isDragging ? 0.3 : 1,
      }}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
};

ProjectCard.propTypes = projectCardProps;

export const ProjectCardPreview = (props) => (
  <ProjectCardContent {...props} showDragHandle={false} />
);

ProjectCardPreview.propTypes = projectCardProps;

export default ProjectCard;
