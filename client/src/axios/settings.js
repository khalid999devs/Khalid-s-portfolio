import axios from 'axios';
import { reqs } from './requests';

export const downloadResume = async () => {
  try {
    const response = await axios.get(reqs.DOWNLOAD_RESUME, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = 'Resume-Khalid Ahammed.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Let the browser begin consuming the URL before releasing it.
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    return true;
  } catch (err) {
    throw new Error(
      err.response?.data?.msg || 'Failed to download the resume',
      { cause: err }
    );
  }
};
