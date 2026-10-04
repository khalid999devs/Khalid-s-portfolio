import { lazy } from 'react';

// The admin panel loads on demand; visitors never download it.
export const Login = lazy(() => import('./Auth/Login.jsx'));
export const Admin = lazy(() => import('./Panel/Admin.jsx'));
export const Dashboard = lazy(() => import('./Panel/Dashboard.jsx'));
export const AdminProjects = lazy(() => import('./Panel/Projects.jsx'));
export const EditProject = lazy(() => import('./Panel/EditProject.jsx'));
export const CreateProject = lazy(() => import('./Panel/CreateProject.jsx'));
export const Settings = lazy(() => import('./Panel/Settings.jsx'));
export const Messaging = lazy(() => import('./Panel/Messaging.jsx'));
