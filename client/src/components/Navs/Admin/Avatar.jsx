import { avatarImg } from '../../../assets';

const Avatar = () => {
  return (
    <div className='w-8.25 h-7.75'>
      <img src={avatarImg} className='w-full h-full' alt='Av' />
    </div>
  );
};

export default Avatar;
