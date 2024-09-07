import { MdClose } from 'react-icons/md';

const IconedText = ({ text, Icon, onIconClick }) => {
  return (
    <div className='bg-secondary-light rounded-full py-1.5 px-3 flex items-center gap-1.5'>
      <p className='text-primary-dark text-xs'>{text || 'Text'}</p>
      <button
        className='text-md flex items-center justify-center text-primary-dark'
        onClick={onIconClick}
      >
        {Icon ? <Icon /> : <MdClose />}
      </button>
    </div>
  );
};

export default IconedText;
