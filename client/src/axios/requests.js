export const serverOrigin = 'http://localhost:8000';
// export const serverOrigin = 'https://api.khalidahammed.com';

export const reqFileWrapper = (src) => {
  if (!src) return null;
  else return serverOrigin + '/' + src;
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
  ADMIN_LOGOUT: '/api/admin/logout', //get
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
