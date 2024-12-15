import React, { useEffect } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import ProjectDetails from '../../../components/Admin/Projects/SingleProject/ProjectDetails';

const EditProject = () => {
  const { setPageTitle } = useOutletContext();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  useEffect(() => {
    setPageTitle('Edit Project');
  }, []);

  return <ProjectDetails mode='edit' projectId={id} />;
};

export default EditProject;
