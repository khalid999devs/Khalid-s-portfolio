import { useEffect, useState } from 'react';
import Input from '../../../components/Forms/Input';
import AdminBar from '../../../components/Navs/Admin/AdminBar';
import { handleInputValChange } from '../../../utils/FormValidations/handleValueChange';
import PrimaryButton from '../../../components/Buttons/PrimaryButton';
import axios from 'axios';
import { reqs } from '../../../axios/requests';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState({
    username: '',
    password: '',
  });
  const [show, setShow] = useState(false);

  useEffect(() => {
    axios
      .get(reqs.IS_ADMIN_VALID, {
        withCredentials: true,
      })
      .then((res) => {
        // console.log(res.data);

        if (res.data.succeed) navigate('/admin');
      })
      .catch(() => {});
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    axios
      .post(
        reqs.ADMIN_LOGIN,
        { userName: data.username, password: data.password },
        { withCredentials: true }
      )
      .then((res) => {
        if (res.data.succeed) navigate('/admin');
        else setError((error) => ({ ...error, password: res.data.msg }));
      })
      .catch((err) => {
        setError((error) => ({
          ...error,
          password: err.response?.data?.msg || 'Login failed',
        }));
      });
  };

  return (
    <div className='min-h-screen'>
      <AdminBar title={'Admin Login'} loginState={true} />
      <div className='max-w-[480px] w-full pt-16 2xl:pt-[150px] m-auto'>
        <form className='grid gap-8' onSubmit={handleSubmit}>
          <div className='bg-primary-dark px-12 py-14 rounded-2xl grid gap-8'>
            <Input
              label={'Username'}
              size='big'
              inputProps={{
                name: 'username',
                value: data.username,
                onChange: (e) => handleInputValChange(e, setData),
              }}
            />
            <Input
              label={'Password'}
              type={show ? 'text' : 'password'}
              show={show}
              size='big'
              onShowClick={() => setShow((show) => !show)}
              inputProps={{
                name: 'password',
                value: data.password,
                onChange: (e) => handleInputValChange(e, setData),
              }}
              alert={{ msg: error.password, state: 'error' }}
            />
          </div>
          <div className='w-full flex items-center justify-center'>
            <PrimaryButton text={'LOGIN'} type={'submit'} />
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
