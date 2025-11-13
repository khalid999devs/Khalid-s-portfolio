/* eslint-disable react-refresh/only-export-components */
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

//client
import Projects from './pages/Projects.jsx';
import About from './pages/About.jsx';
import SingleProject from './pages/SingleProject.jsx';
import CodingLab from './pages/CodingLab.jsx';

import { HelmetProvider } from 'react-helmet-async';
import Loader from './components/utils/Loader.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'projects',
        element: <Projects />,
      },
      {
        path: 'about-me',
        element: <About />,
      },
      {
        path: 'singleProject/:value',
        element: <SingleProject />,
      },
      {
        path: 'coding-lab',
        element: <CodingLab />,
      },
    ],
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

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <RouterProvider router={router} />
  </HelmetProvider>
);
