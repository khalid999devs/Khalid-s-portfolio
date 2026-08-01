import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './axios/global.js';
import App from './App.jsx';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ErrorPage from './pages/ErrorPage.jsx';
import Home from './pages/Home.jsx';

//admin
const Login = lazy(() => import('./pages/Admin/Auth/Login.jsx'));
const Admin = lazy(() => import('./pages/Admin/Panel/Admin.jsx'));
const Dashboard = lazy(() => import('./pages/Admin/Panel/Dashboard.jsx'));
const AdminProjects = lazy(() => import('./pages/Admin/Panel/Projects.jsx'));
const EditProject = lazy(() => import('./pages/Admin/Panel/EditProject.jsx'));
const CreateProject = lazy(() =>
  import('./pages/Admin/Panel/CreateProject.jsx')
);
const Settings = lazy(() => import('./pages/Admin/Panel/Settings.jsx'));
const Messaging = lazy(() => import('./pages/Admin/Panel/Messaging.jsx'));

//client
import Projects from './pages/Projects.jsx';
import About from './pages/About.jsx';
import SingleProject from './pages/SingleProject.jsx';
import CodingLab from './pages/CodingLab.jsx';

import Loader from './components/utils/Loader.jsx';
import { publicRoutes } from './Constants/routes.js';

const PAGES = {
  home: <Home />,
  projects: <Projects />,
  about: <About />,
  singleProject: <SingleProject />,
  codingLab: <CodingLab />,
};

// The same children this used to spell out, built from the manifest the
// sitemap generator also reads. One list, so a new page cannot exist in the
// router and be missing from search.
//
// A route with no entry in PAGES throws at module load. React Router renders
// an undefined element as nothing, which is a blank page that looks like a
// routing bug and takes far longer to find than this.
const publicChildren = publicRoutes.map(({ id, path }) => {
  const element = PAGES[id];
  if (!element) throw new Error(`No page component for route "${id}"`);

  return path === '/'
    ? { index: true, element }
    : { path: path.slice(1), element };
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorPage />,
    children: publicChildren,
  },
  {
    path: '/admin-login',
    element: (
      <Suspense fallback={<Loader classes={'z-40 !w-screen !h-screen'} />}>
        <Login />
      </Suspense>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<Loader classes={'z-40 !w-screen !h-screen'} />}>
        <Admin />
      </Suspense>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'projects',
        element: <AdminProjects />,
      },
      {
        path: 'edit-project/:value',
        element: <EditProject />,
      },
      {
        path: 'add-project',
        element: <CreateProject />,
      },
      {
        path: 'messaging',
        element: <Messaging />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
  {
    path: '/error',
    element: <ErrorPage />,
  },
]);

// No HelmetProvider: MetaCard renders <title>/<meta> directly and React 19
// hoists them into <head>. See the note in MetaCard.jsx.
createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
);
