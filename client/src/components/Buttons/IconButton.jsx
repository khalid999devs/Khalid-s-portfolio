import { MdNotificationsNone } from 'react-icons/md';

const IconButton = ({ classes, onClick, Icon = MdNotificationsNone }) => {
  return (
    <div
      className={
        'w-[33px] h-[31px] flex items-center justify-center cursor-pointer text-secondary-light text-xl border-secondary-light border-1 border rounded-[10px] hover:bg-secondary-light transition-all duration-300 hover:text-body-main group ' +
        classes
      }
      onClick={onClick}
    >
      {
        <Icon className='group-hover:text-body-main group-hover:transition-all group-hover:duration-300' />
      }
    </div>
  );
};

export default IconButton;
