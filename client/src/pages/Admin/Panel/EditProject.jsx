import React from 'react';
import { useParams } from 'react-router-dom';

const EditProject = () => {
  const { value } = useParams();
  return <div>EditProject- {value}</div>;
};

export default EditProject;
