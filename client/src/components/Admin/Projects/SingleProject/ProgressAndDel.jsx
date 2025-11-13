import NumberedText from './NumberedText';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { MdOutlineDelete } from 'react-icons/md';
import PropTypes from 'prop-types';

const ProgressAndDel = ({
  formMode = 'info',
  mode,
  setFormMode,
  handleDelete,
  projectId,
  projectName,
}) => {
  return (
    <div className={`w-full h-min flex items-center justify-between `}>
      <div className='flex items-center gap-4 justify-between'>
        <NumberedText
          number={1}
          text={'Project Titles'}
          state={formMode === 'info' ? 'active' : 'inactive'}
          onClick={
            mode === 'edit'
              ? () => {
                  setFormMode('info');
                }
              : null
          }
        />
        <div className='w-8 h-[1.2px] bg-secondary-light'></div>
        <NumberedText
          number={2}
          text={'Project Details'}
          state={formMode === 'content' ? 'active' : 'inactive'}
          onClick={
            mode === 'edit'
              ? () => {
                  setFormMode('content');
                }
              : null
          }
        />
      </div>

      {projectId && (
        <PrimaryButton
          onClick={() => handleDelete(projectId, projectName)}
          Icon={MdOutlineDelete}
          classes={`!rounded-full`}
          btnState={'error'}
          text={'DELETE'}
          state='small'
        />
      )}
    </div>
  );
};


ProgressAndDel.propTypes = {
  formMode: PropTypes.string,
  mode: PropTypes.string,
  setFormMode: PropTypes.func,
  handleDelete: PropTypes.func,
  projectId: PropTypes.number,
  projectName: PropTypes.string,
};

export default ProgressAndDel;
