const configuredServerOrigin = import.meta.env.VITE_API_URL?.trim();

export const serverOrigin = (
  configuredServerOrigin || (import.meta.env.DEV ? 'http://localhost:8000' : '')
).replace(/\/+$/, '');

export const reqFileWrapper = (src) => {
  if (typeof src !== 'string') return null;

  const trimmedSrc = src.trim();
  if (!trimmedSrc) return null;

  if (/^https?:\/\//i.test(trimmedSrc)) {
    try {
      return new URL(trimmedSrc).href;
    } catch {
      return null;
    }
  }

  // Do not pass unsafe or protocol-relative URLs through to src/window.open.
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmedSrc) || trimmedSrc.startsWith('//')) {
    return null;
  }

  const normalizedPath = `/${trimmedSrc.replace(/^\/+/, '')}`;
  return serverOrigin ? `${serverOrigin}${normalizedPath}` : normalizedPath;
};

export const validFileWrapper = (fileImg) => {
  if (typeof fileImg === 'object') {
    if (fileImg.name) {
      return window.URL.createObjectURL(fileImg);
    } else {
      return null;
    }
  } else {
    return reqFileWrapper(fileImg);
  }
};

//API REQUESTS ENUMS
export const reqs = {
  //admin
  ADMIN_LOGIN: '/api/admin/login', //post
  ADMIN_LOGOUT: '/api/admin/logout', //post
  IS_ADMIN_VALID: '/api/admin/auth', //get

  //settings
  GET_SETTINGS: '/api/settings', //get
  ADD_SETTINGS: '/api/settings/add', //post
  EDIT_SETTINGS: '/api/settings/edit', //patch
  DOWNLOAD_RESUME: '/api/settings/download-resume', //get

  //projects
  GET_PROJECT: '/api/projects', //post
  CREATE_PROJECT: '/api/projects/create', //post
  UPDATE_PROJECT_CONTENT: '/api/projects/update-content', //put
  EDIT_PROJECT_INFOS: '/api/projects/edit-infos', //patch
  EDIT_PROJECT_CONTENTS: '/api/projects/edit-contents', //patch
  DELETE_PROJECT_CONTENTS: '/api/projects/delete-contents', //patch
  DELETE_PROJECT: '/api/projects/delete', //delete
  REORDER_PROJECTS: '/api/projects/reorder', //patch

  //contacts
  SEND_MESSAGE_FROM_CLIENT: '/api/contact/sendMessage', //post
  GET_ALL_MESSAGES: '/api/contact/messages', //get
  SEND_EMAIL_TO_CLIENT: '/api/contact/emailToClient', //post
  SEND_SMS_TO_CLIENT: '/api/contact/smsToClient/custom', //post
};
