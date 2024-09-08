import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ProjectDetails from '../../../components/Admin/Projects/SingleProject/ProjectDetails';

const EditProject = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  return <ProjectDetails mode='edit' projectId={id} />;
};

export default EditProject;
