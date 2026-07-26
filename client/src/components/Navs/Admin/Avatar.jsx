import { avatarImg } from '../../../assets';

const Avatar = () => {
  return (
    <div className='w-[33px] h-[31px]'>
      <img
        src={avatarImg}
        width='42'
        height='41'
        className='w-full h-full'
        alt='Admin profile'
      />
    </div>
  );
};

export default Avatar;
