import { MdEdit } from 'react-icons/md';
import { MdOutlineDelete } from 'react-icons/md';
import RoundedIconBtn from '../../Buttons/RoundedIconBtn';
import { useNavigate } from 'react-router-dom';
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
    <div className='h-[385px] max-w-[318px] w-full bg-primary-dark rounded-xl box-big-shadow px-2 pt-3 pb-3.5 grid gap-5'>
      <div className='relative rounded-lg overflow-hidden w-full h-[200px] bg-white'>
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
      <div className='px-3.5'>
        <div className='grid gap-8'>
          <div className='grid gap-3'>
            <h1 className='text-xl'>{title || 'Project Title'}</h1>
            <p className='text-sm text-montreal-mono text-secondary-dark'>
              {subtitle || 'Project Subtitle'}
            </p>
          </div>

          <PrimaryButton
            classes={`!text-sm w-full !rounded-full`}
            text={'Details'}
            onClick={() => navigate(`/admin/edit-project/${value}?id=${id}`)}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
