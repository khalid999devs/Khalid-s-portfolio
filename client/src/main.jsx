/* eslint-disable react-refresh/only-export-components */
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  ScrollRestoration,
} from 'react-router-dom';
import './axios/global.js';
import './index.css';

const App = lazy(() => import('./App.jsx'));
const ErrorPage = lazy(() => import('./pages/ErrorPage.jsx'));

// Public routes
const Home = lazy(() => import('./pages/Home.jsx'));
const Projects = lazy(() => import('./pages/Projects.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const SingleProject = lazy(() => import('./pages/SingleProject.jsx'));

// Admin routes
const Login = lazy(() => import('./pages/Admin/Auth/Login.jsx'));
const Admin = lazy(() => import('./pages/Admin/Panel/Admin.jsx'));
const Dashboard = lazy(() => import('./pages/Admin/Panel/Dashboard.jsx'));
const AdminProjects = lazy(() => import('./pages/Admin/Panel/Projects.jsx'));
const EditProject = lazy(() => import('./pages/Admin/Panel/EditProject.jsx'));
const CreateProject = lazy(() =>
  import('./pages/Admin/Panel/CreateProject.jsx')
);
const Settings = lazy(() => import('./pages/Admin/Panel/Settings.jsx'));

const fullPageFallback = (
  <div
    className='bg-body-main min-h-screen w-full flex items-center justify-center text-onPrimary-main'
    role='status'
    aria-live='polite'
  >
    <span className='text-sm uppercase'>Loading page…</span>
  </div>
);

const contentFallback = (
  <div
    className='min-h-[50vh] w-full flex items-center justify-center text-onPrimary-main'
    role='status'
    aria-live='polite'
  >
    <span className='text-sm uppercase'>Loading page…</span>
  </div>
);

const suspend = (Component, fallback = contentFallback) => (
  <Suspense fallback={fallback}>
    <Component />
  </Suspense>
);

const router = createBrowserRouter([
  {
    element: (
      <>
        <ScrollRestoration />
        <Outlet />
      </>
    ),
    children: [
      {
        path: '/',
        element: suspend(App, fullPageFallback),
        errorElement: suspend(ErrorPage, fullPageFallback),
        children: [
          {
            index: true,
            element: suspend(Home),
          },
          {
            path: 'projects',
            element: suspend(Projects),
          },
          {
            path: 'about-me',
            element: suspend(About),
          },
          {
            path: 'singleProject/:value',
            element: suspend(SingleProject),
          },
        ],
      },
      {
        path: '/admin-login',
        element: suspend(Login, fullPageFallback),
        errorElement: suspend(ErrorPage, fullPageFallback),
      },
      {
        path: '/admin',
        element: suspend(Admin, fullPageFallback),
        errorElement: suspend(ErrorPage, fullPageFallback),
        children: [
          {
            index: true,
            element: suspend(Dashboard),
          },
          {
            path: 'projects',
            element: suspend(AdminProjects),
          },
          {
            path: 'edit-project/:value',
            element: suspend(EditProject),
          },
          {
            path: 'add-project',
            element: suspend(CreateProject),
          },
          {
            path: 'settings',
            element: suspend(Settings),
          },
        ],
      },
      {
        path: '/error',
        element: suspend(ErrorPage, fullPageFallback),
      },
      // Without this, an unmatched URL reached React Router's built-in error
      // boundary: an unstyled page that still advertised the site's default
      // title and a canonical link back to the home page. Search engines read
      // that as a soft 404 and may index the broken URL. The project's own
      // error page renders a real 404 and withholds both.
      {
        path: '*',
        element: suspend(ErrorPage, fullPageFallback),
      },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
