import { useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

const dashboardActions = [
  {
    description: 'Review, reorder, edit, or remove published portfolio work.',
    label: 'Manage projects',
    path: 'projects',
  },
  {
    description: 'Create a project record before adding its media and links.',
    label: 'Add a project',
    path: 'add-project',
  },
  {
    description: 'Maintain the technology groups displayed on public pages.',
    label: 'Edit settings',
    path: 'settings',
  },
];

const Dashboard = () => {
  const { setPageTitle } = useOutletContext();

  useEffect(() => {
    setPageTitle('Dashboard');
  }, [setPageTitle]);

  return (
    <div className='w-full pb-20'>
      <section
        className='box-big-shadow rounded-xl bg-primary-dark p-6 sm:p-8'
        aria-labelledby='dashboard-heading'
      >
        <p className='text-xs uppercase tracking-[0.18em] text-muted-light'>
          Portfolio administration
        </p>
        <h1 id='dashboard-heading' className='mt-3 text-2xl sm:text-3xl'>
          Choose what you want to maintain
        </h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-onPrimary-dark'>
          Changes here affect the public portfolio. Review content and uploaded
          media before saving, and use the dedicated project list to control
          display order.
        </p>
      </section>

      <nav
        aria-label='Dashboard actions'
        className='mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'
      >
        {dashboardActions.map((action) => (
          <Link
            key={action.path}
            to={action.path}
            className='box-big-shadow group min-h-[190px] rounded-xl bg-primary-dark p-6 transition-colors hover:bg-secondary-main/30'
          >
            <span className='text-xl group-hover:underline'>
              {action.label}
            </span>
            <span className='mt-4 block text-sm leading-6 text-muted-light'>
              {action.description}
            </span>
            <span
              aria-hidden='true'
              className='mt-8 block text-sm text-primary-main transition-transform group-hover:translate-x-1'
            >
              Open →
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Dashboard;
