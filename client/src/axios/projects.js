import axios from 'axios';
import { reqs } from './requests';

export const deleteProject = async (
  projectId,
  setLoading = () => {}
) => {
  setLoading(true);

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
