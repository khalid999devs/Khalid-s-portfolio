import axios from 'axios';
import { reqs } from './requests';

/**
 * The server answers errors as JSON, but this request asks for a blob, so axios
 * hands back the error body as a Blob too -- `err.response.data.msg` was always
 * undefined and every failure surfaced as the generic fallback. Read the blob
 * back as text so the real reason ("No resume has been uploaded yet.") reaches
 * the user.
 */
const messageFromBlobError = async (error) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.msg) return parsed.msg;
    } catch {
      // Not JSON. Fall through to the generic message.
    }
  }
  return data?.msg || 'Failed to download the resume';
};

export const downloadResume = async () => {
  try {
    const response = await axios.get(reqs.DOWNLOAD_RESUME, {
      responseType: 'blob',
    });

    // The filename the server chose, taken from Content-Disposition when it is
    // exposed. Falls back to a sensible name rather than the random stored one.
    const disposition = response.headers?.['content-disposition'] || '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : 'Resume.pdf';

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const href = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Without this the blob is held for the lifetime of the document.
    window.URL.revokeObjectURL(href);
  } catch (error) {
    alert('Error: ' + (await messageFromBlobError(error)));
  }
};

/** Admin: replace the stored resume. `file` is a File from an input or drop. */
export const uploadResume = async (file) => {
  const form = new FormData();
  form.append('resume', file);

  const { data } = await axios.patch(reqs.UPLOAD_RESUME, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    withCredentials: true,
  });
  return data;
};

/** Admin: remove the stored resume. */
export const deleteResume = async () => {
  const { data } = await axios.delete(reqs.DELETE_RESUME, {
    withCredentials: true,
  });
  return data;
};
