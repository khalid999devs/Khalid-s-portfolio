import axios from 'axios';
import { reqs } from './requests';

export const deleteProject = async (
  projectId,
  projectName,
  setLoading = () => {},
  setPopup
) => {
  const userValidate = prompt(
    `Please type "${projectName}" below and press 'ok' to delete it: `
  );
  if (userValidate !== projectName) {
    if (userValidate === null) return { cancelled: true };
    alert('Please Enter the exact Project name to delete!');
    return { cancelled: true };
  }

  setLoading(true);
  setPopup?.({
    text: 'Deleting...',
    type: 'normal',
    state: true,
  });

  try {
    const res = await axios.delete(`${reqs.DELETE_PROJECT}/${projectId}`, {
      withCredentials: true,
    });

    if (!res.data.succeed) throw res.data;
    return res.data;
  } catch (err) {
    throw err.response?.data || err || { msg: 'Failed to delete project' };
  } finally {
    setLoading(false);
  }
};

export const reorderProjects = (projectOrders) => {
  return new Promise((resolve, reject) => {
    axios
      .patch(
        reqs.REORDER_PROJECTS,
        { projectOrders },
        {
          withCredentials: true,
        }
      )
      .then((res) => {
        if (res.data.succeed) {
          resolve(res.data);
        } else {
          reject(res.data);
        }
      })
      .catch((err) => {
        reject(err.response?.data || { msg: 'Failed to reorder projects' });
      });
  });
};
