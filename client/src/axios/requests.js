// The API origin used to be a hardcoded constant with the production URL sitting
// commented out beneath it, so every deploy required hand-editing this file and
// the committed state always pointed at localhost. Set VITE_API_URL at build
// time instead; the fallback preserves the previous local-development default.
export const serverOrigin =
  import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

  //admin accounts (all require an admin session AND the actor's own password)
  ADMIN_ACCOUNTS: '/api/admin/accounts', //get list, post create
  ADMIN_PASSWORD: '/api/admin/password', //patch, change own password

  //about page content (experience, education, achievements)
  GET_ABOUT: '/api/about', //get, public
  ABOUT_ENTRIES: '/api/about', //post create, patch /:id, delete /:id
  REORDER_ABOUT: '/api/about/reorder', //patch

  //delivery logs (email and sms), admin only
  GET_LOGS: '/api/logs', //get

  //deployment alerts, admin only
  GET_NOTIFICATIONS: '/api/notifications', //get

  //dashboard statistics, admin only
  GET_STATS: '/api/stats', //get

  //anonymous visit tracking
  TRACK_VISIT: '/api/visits', //post, public, fire and forget
  GET_VISIT_STATS: '/api/visits/stats', //get, admin
  VISIT_RETENTION: '/api/visits/retention', //patch, admin

  //settings
  GET_SETTINGS: '/api/settings', //get
  ADD_SETTINGS: '/api/settings/add', //post
  EDIT_SETTINGS: '/api/settings/edit', //patch
  DOWNLOAD_RESUME: '/api/settings/download-resume', //get
  UPLOAD_RESUME: '/api/settings/resume', //patch, admin, multipart
  DELETE_RESUME: '/api/settings/resume', //delete, admin

  //projects
  GET_PROJECT: '/api/projects', //post
  CREATE_PROJECT: '/api/projects/create', //post
  UPDATE_PROJECT_CONTENT: '/api/projects/update-content', //put
  EDIT_PROJECT_INFOS: '/api/projects/edit-infos', //patch
  EDIT_PROJECT_CONTENTS: '/api/projects/edit-contents', //patch
  DELETE_PROJECT_CONTENTS: '/api/projects/delete-contents', //patch
  DELETE_PROJECT: '/api/projects/delete', //delete
  REORDER_PROJECTS: '/api/projects/reorder', //patch

  //outbound messaging, admin only
  SEND_EMAIL: '/api/contact/emailToClient', //post, append /:mode
  SEND_SMS: '/api/contact/smsToClient', //post, append /:mode
  SEND_BULK_EMAIL: '/api/contact/bulkEmail', //post
  SEND_BULK_SMS: '/api/contact/bulkSms', //post
  SMS_BALANCE: '/api/contact/sms-balance', //get
};
