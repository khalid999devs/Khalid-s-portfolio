import { useEffect, useState } from 'react';
import Input from '../../../components/Forms/Input';
import AdminBar from '../../../components/Navs/Admin/AdminBar';
import { handleInputValChange } from '../../../utils/FormValidations/handleValueChange';
import PrimaryButton from '../../../components/Buttons/PrimaryButton';
import axios from 'axios';
import { reqs } from '../../../axios/requests';
import { useNavigate } from 'react-router-dom';
import MetaCard from '../../../components/utils/MetaCard';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    axios
      .get(reqs.IS_ADMIN_VALID, {
        signal: controller.signal,
      })
      .then((res) => {
        if (res.data.succeed) navigate('/admin', { replace: true });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError((currentError) => ({ ...currentError, password: '' }));

    try {
      const response = await axios.post(reqs.ADMIN_LOGIN, {
        userName: data.username,
        password: data.password,
      });

      if (response.data.succeed) {
        navigate('/admin', { replace: true });
      } else {
        setError((currentError) => ({
          ...currentError,
          password: response.data.msg,
        }));
      }
    } catch (requestError) {
      setError((currentError) => ({
        ...currentError,
        password: requestError.response?.data?.msg || 'Login failed',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen'>
      <MetaCard title='Administrator sign in' noIndex />
      <AdminBar title={'Admin Login'} loginState={true} />
      <div className='max-w-[480px] w-full pt-16 2xl:pt-[150px] m-auto'>
        <form className='grid gap-8' onSubmit={handleSubmit}>
          <div className='bg-primary-dark px-12 py-14 rounded-2xl grid gap-8'>
            <Input
              label={'Username'}
              size='big'
              inputProps={{
                autoComplete: 'username',
                maxLength: 255,
                name: 'username',
                required: true,
                spellCheck: false,
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
                autoComplete: 'current-password',
                maxLength: 1024,
                name: 'password',
                required: true,
                value: data.password,
                onChange: (e) => handleInputValChange(e, setData),
              }}
              alert={{ msg: error.password, state: 'error' }}
            />
          </div>
          <div className='w-full flex items-center justify-center'>
            <PrimaryButton
              disabled={isSubmitting}
              text={isSubmitting ? 'SIGNING IN…' : 'LOGIN'}
              type='submit'
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
