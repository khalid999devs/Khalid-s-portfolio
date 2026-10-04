import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ErrorPage from './pages/ErrorPage.jsx';
import Home from './pages/Home.jsx';

//admin
import {
  Login,
  Admin,
  Dashboard,
  AdminProjects,
  EditProject,
  CreateProject,
  Settings,
  Messaging,
} from './pages/Admin/lazy.js';

//client
import Projects from './pages/Projects.jsx';
import About from './pages/About.jsx';
import SingleProject from './pages/SingleProject.jsx';
import CodingLab from './pages/CodingLab.jsx';

import Loader from './components/utils/Loader.jsx';
import Started from './components/utils/Started.jsx';
import { publicRoutes } from './Constants/routes.js';
import { installChunkRecovery } from './utils/chunkRecovery.js';
import { installErrorReporting, reportError } from './utils/reportError.js';

installErrorReporting();
installChunkRecovery();

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
      <Suspense fallback={<Loader classes={'z-40 w-screen! h-screen!'} />}>
        <Login />
      </Suspense>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<Loader classes={'z-40 w-screen! h-screen!'} />}>
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
const mount = () =>
  createRoot(document.getElementById('root'), {
    // Errors an error boundary caught: logged as before, and reported.
    onCaughtError: (error, info) => {
      console.error(error, info?.componentStack);
      reportError('react', error);
    },
  }).render(
    <Started>
      <RouterProvider router={router} />
    </Started>
  );

// The build loads the stylesheet without blocking the first paint (see
// vite.config.js), so the app waits for it here and never renders unstyled.
const stylesheet = document.querySelector('link[data-app-css]');

// The link's own handlers switch it on as well; done here too so the app
// never depends on an inline handler having run.
const start = () => {
  if (stylesheet) stylesheet.media = 'all';
  mount();
};

if (!stylesheet || stylesheet.sheet || stylesheet.media !== 'print') {
  start();
} else {
  stylesheet.addEventListener('load', start, { once: true });
  stylesheet.addEventListener('error', start, { once: true });
}
