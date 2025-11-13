import { FaExclamationTriangle } from 'react-icons/fa';

const ErrorPage = () => {
  return (
    <div className='min-h-screen bg-body-main flex items-center justify-center p-6'>
      <div className='bg-primary-dark text-primary-main rounded-2xl shadow-xl p-10 max-w-xl w-full text-center'>
        {/* Icon */}
        <FaExclamationTriangle className='text-secondary-light text-6xl mx-auto mb-6' />

        {/* Error Code */}
        <h1 className='text-7xl font-bold text-onPrimary-dark mb-6'>404</h1>

        {/* Heading */}
        <h2 className='text-3xl font-semibold text-onPrimary-main mb-4'>
          Oops! Page not found
        </h2>

        {/* Description */}
        <p className='text-secondary-light mb-8'>
          The page you’re looking for doesn’t exist or might have been moved.
        </p>

        {/* Go Home Button */}
        <a
          href='/'
          className='inline-block bg-secondary-dark text-primary-main py-3 px-8 rounded-xl hover:bg-secondary-light transition duration-300'
        >
          Go Home
        </a>
      </div>
    </div>
  );
};

export default ErrorPage;
