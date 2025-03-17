import axios from 'axios';
import { reqs } from './requests';

export const downloadResume = () => {
  axios
    .get(reqs.DOWNLOAD_RESUME, { responseType: 'blob' })
    .then((response) => {
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'Resume-Khalid Ahammed.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch((err) => {
      alert('Error: ' + (err.response?.data?.msg || 'Failed to download file'));
    });
};
