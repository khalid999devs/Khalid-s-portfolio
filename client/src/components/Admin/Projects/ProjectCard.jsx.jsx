import { MdOutlineDelete } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import RoundedIconBtn from '../../Buttons/RoundedIconBtn';
import PrimaryButton from '../../Buttons/PrimaryButton';
import { projectPlaceholder } from '../../../assets';

const ProjectCard = ({
  id,
  title,
  subtitle,
  img,
  value = 'project-val',
  handleDeleteProject,
}) => {
  const navigate = useNavigate();

  return (
    <div className='min-h-[300px] max-w-[312px] w-full bg-primary-dark rounded-xl box-big-shadow px-2 pt-3 pb-3.5 flex flex-col'>
      <div className='relative rounded-lg overflow-hidden w-full h-[190px] bg-white flex-shrink-0'>
        <img
          src={img || projectPlaceholder}
          className='w-full h-full object-cover'
          alt='Project Image'
        />
        <div className='absolute right-3 top-3 flex gap-2 items-center'>
          <RoundedIconBtn
            onClick={() => navigate(`/admin/edit-project/${value}?id=${id}`)}
            classes={`hover:!bg-green-800`}
          />
          <RoundedIconBtn
            onClick={() => handleDeleteProject(id, title)}
            Icon={MdOutlineDelete}
            classes={`hover:!bg-red-700`}
          />
        </div>
      </div>
      <div className='px-3.5 flex-1 flex flex-col justify-between pt-5'>
        <div className='grid gap-3'>
          <h1 className='text-xl line-clamp-2 leading-tight'>
            {title || 'Project Title'}
          </h1>
          <p className='text-sm text-montreal-mono text-secondary-dark line-clamp-1'>
            {subtitle || 'Project Subtitle'}
          </p>
        </div>

        <PrimaryButton
          classes={`!text-sm w-full !rounded-full mt-5 mb-1/2`}
          text={'Details'}
          onClick={() => navigate(`/admin/edit-project/${value}?id=${id}`)}
        />
      </div>
    </div>
  );
};

ProjectCard.propTypes = {
  id: PropTypes.number.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  img: PropTypes.string,
  value: PropTypes.string,
  handleDeleteProject: PropTypes.func.isRequired,
};

export default ProjectCard;
