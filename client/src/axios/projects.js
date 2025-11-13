import axios from 'axios';
import { reqs } from './requests';

export const deleteProject = (
  projectId,
  projectName,
  setLoading = () => {},
  setPopup
) => {
  const userValidate = prompt(
    `Please type "${projectName}" below and press 'ok' to delete it: `
  );
  if (userValidate === projectName) {
    setLoading(true);
    setPopup &&
      setPopup({
        text: 'Deleting...',
        type: 'normal',
        state: true,
      });
    return new Promise((resolve, reject) => {
      axios
        .delete(`${reqs.DELETE_PROJECT}/${projectId}`, {
          withCredentials: true,
        })
        .then((res) => {
          setLoading(false);
          if (res.data.succeed) {
            resolve(res.data);
          } else {
            reject(res.data);
          }
        })
        .catch((err) => {
          setLoading(false);
          reject(err.response?.data || { msg: 'Failed to delete project' });
        });
    });
  } else {
    alert('Please Enter the exact Project name to delete!');
  }
};
