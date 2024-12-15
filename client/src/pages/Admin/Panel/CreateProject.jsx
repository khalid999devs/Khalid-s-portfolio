import React, { useEffect } from 'react';
import ProjectDetails from '../../../components/Admin/Projects/SingleProject/ProjectDetails';
import { useOutletContext } from 'react-router-dom';

const CreateProject = () => {
  const { setPageTitle } = useOutletContext();
  useEffect(() => {
    setPageTitle('Add Project');
  }, []);
  return (
    <>
      <ProjectDetails />
    </>
  );
};

export default CreateProject;
