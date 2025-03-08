import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './axios/global.js';
import App from './App.jsx';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ErrorPage from './pages/ErrorPage.jsx';
import Home from './pages/Home.jsx';

//admin
import Login from './pages/Admin/Auth/Login.jsx';
import Admin from './pages/Admin/Panel/Admin.jsx';
import Dashboard from './pages/Admin/Panel/Dashboard.jsx';
import { Projects as AdminProjects } from './pages/Admin/Panel/Projects.jsx';
import EditProject from './pages/Admin/Panel/EditProject.jsx';
import CreateProject from './pages/Admin/Panel/CreateProject.jsx';
import Settings from './pages/Admin/Panel/Settings.jsx';

//client
import Projects from './pages/Projects.jsx';
import About from './pages/About.jsx';
import SingleProject from './pages/SingleProject.jsx';
import CodingLab from './pages/CodingLab.jsx';

import { HelmetProvider } from 'react-helmet-async';
import { LenisGSAP } from './animations/LenisGSAP.jsx';
import { AnimatePresence } from 'framer-motion';

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
        path: 'About',
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
    element: <Login />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin',
    element: <Admin />,
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
]);

createRoot(document.getElementById('root')).render(
  <LenisGSAP>
    <HelmetProvider>
      {/* <AnimatePresence mode='wait'> */}
      <RouterProvider router={router} />
      {/* </AnimatePresence> */}
    </HelmetProvider>
  </LenisGSAP>
);
