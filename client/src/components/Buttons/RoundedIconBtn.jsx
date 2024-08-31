import { MdEdit } from 'react-icons/md';

const RoundedIconBtn = ({ Icon, classes, onClick }) => {
  return (
    <button
      className={
        'w-7 h-7 rounded-full bg-primary-dark text-white text-md transition-all duration-300 hover:bg-black flex items-center justify-center ' +
        classes
      }
      onClick={onClick}
    >
      {Icon ? <Icon /> : <MdEdit />}
    </button>
  );
};

export default RoundedIconBtn;
