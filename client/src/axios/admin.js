import axios from 'axios';
import { reqs } from './requests';

/**
 * Administrator account management.
 *
 * Every call here sends the acting administrator's own password alongside the
 * session cookie. That is deliberate: the cookie proves which account is signed
 * in, the password proves the person at the keyboard is its owner. A laptop
 * left unlocked should not be enough to add a second administrator.
 *
 * Passwords are only ever sent, never stored or logged client-side.
 */

export const listAdmins = async () => {
  const { data } = await axios.get(reqs.ADMIN_ACCOUNTS, {
    withCredentials: true,
  });
  return data;
};

export const changeOwnPassword = async ({ currentPassword, newPassword }) => {
  const { data } = await axios.patch(
    reqs.ADMIN_PASSWORD,
    { currentPassword, newPassword },
    { withCredentials: true }
  );
  return data;
};

export const createAdmin = async ({ userName, password, currentPassword }) => {
  const { data } = await axios.post(
    reqs.ADMIN_ACCOUNTS,
    { userName, password, currentPassword },
    { withCredentials: true }
  );
  return data;
};

export const removeAdmin = async ({ id, currentPassword }) => {
  const { data } = await axios.delete(`${reqs.ADMIN_ACCOUNTS}/${id}`, {
    withCredentials: true,
    // DELETE with a body is unusual but correct here: the confirmation password
    // must not end up in a URL, where it would be logged by every proxy and
    // stored in browser history.
    data: { currentPassword },
  });
  return data;
};
