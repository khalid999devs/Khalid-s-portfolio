import { FaExclamationTriangle } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';

const ErrorPage = () => {
  const location = useLocation();
  const isServiceError = location.state?.errorType === 'service';
  const retryPath = location.state?.retryPath;
  const status = isServiceError ? '503' : '404';
  const heading = isServiceError
    ? 'Portfolio temporarily unavailable'
    : 'Oops! Page not found';
  const description = isServiceError
    ? 'The project could not be loaded because the service did not respond. Please try again.'
    : 'The page you’re looking for doesn’t exist or might have been moved.';

  return (
    <div className='min-h-screen bg-body-main flex items-center justify-center p-6'>
      <div className='bg-primary-dark text-primary-main rounded-2xl shadow-xl p-10 max-w-xl w-full text-center'>
        <FaExclamationTriangle
          aria-hidden='true'
          className='text-muted-light text-6xl mx-auto mb-6'
        />

        <h1 className='text-7xl font-bold text-onPrimary-dark mb-6'>
          {status}
        </h1>

        <h2 className='text-3xl font-semibold text-onPrimary-main mb-4'>
          {heading}
        </h2>

        <p className='text-muted-light mb-8'>{description}</p>

        <div className='flex flex-wrap items-center justify-center gap-3'>
          {isServiceError && retryPath && (
            <Link
              to={retryPath}
              replace
              className='inline-block bg-primary-main text-body-main py-3 px-8 rounded-xl hover:bg-onPrimary-main transition duration-300'
            >
              Try Again
            </Link>
          )}
          <Link
            to='/'
            className='inline-block bg-secondary-dark text-primary-main py-3 px-8 rounded-xl hover:bg-secondary-light transition duration-300'
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
