import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { MdPersonAdd, MdLockReset, MdDelete } from 'react-icons/md';
import {
  listAdmins,
  changeOwnPassword,
  createAdmin,
  removeAdmin,
} from '../../../axios/admin';

// Kept in step with server/utils/adminCredentials.js. The server is the
// authority; this only avoids a pointless round trip.
const MINIMUM_PASSWORD_LENGTH = 16;

const field =
  'w-full bg-body-main/40 border border-secondary-main/50 rounded-md px-3 py-2 text-sm outline-none focus:border-onPrimary-main transition-all duration-300';

const AccountManager = ({ setPopup }) => {
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [nw, setNw] = useState({ userName: '', password: '', confirm: '', current: '' });

  const report = (text, type) => setPopup({ text, type, state: true });

  const refresh = useCallback(async () => {
    try {
      const data = await listAdmins();
      setAccounts(data.result || []);
    } catch (error) {
      report(
        error.response?.data?.msg || 'Could not load administrator accounts',
        'error'
      );
    }
    // setPopup is stable for the lifetime of the page; listing it would
    // re-create this callback on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submitPassword = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return report('The new passwords do not match.', 'error');
    if (pw.next.length < MINIMUM_PASSWORD_LENGTH) {
      return report(
        `Use at least ${MINIMUM_PASSWORD_LENGTH} characters for the new password.`,
        'error'
      );
    }

    setBusy(true);
    try {
      const data = await changeOwnPassword({
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setPw({ current: '', next: '', confirm: '' });
      report(data.msg || 'Password updated', 'success');
    } catch (error) {
      report(error.response?.data?.msg || 'Could not change the password', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitNewAdmin = async (e) => {
    e.preventDefault();
    if (nw.password !== nw.confirm) return report('The passwords do not match.', 'error');
    if (nw.password.length < MINIMUM_PASSWORD_LENGTH) {
      return report(
        `Use at least ${MINIMUM_PASSWORD_LENGTH} characters for the new account.`,
        'error'
      );
    }

    setBusy(true);
    try {
      const data = await createAdmin({
        userName: nw.userName,
        password: nw.password,
        currentPassword: nw.current,
      });
      setNw({ userName: '', password: '', confirm: '', current: '' });
      report(data.msg || 'Administrator created', 'success');
      refresh();
    } catch (error) {
      report(error.response?.data?.msg || 'Could not create the account', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (account) => {
    const currentPassword = window.prompt(
      `Removing "${account.userName}". Enter your own password to confirm.`
    );
    if (!currentPassword) return;

    setBusy(true);
    try {
      const data = await removeAdmin({ id: account.id, currentPassword });
      report(data.msg || 'Administrator removed', 'success');
      refresh();
    } catch (error) {
      report(error.response?.data?.msg || 'Could not remove the account', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='col-span-9 grid gap-5'>
      {/*
        Three cards rather than one long stack of forms. The account list,
        changing your own password, and adding somebody else are three different
        jobs; running them together made it hard to see where one ended.
      */}
      <div className='box-big-shadow bg-primary-dark rounded-xl p-6 grid gap-4'>
        <div className='flex items-baseline gap-3 border-b border-secondary-main/30 pb-4'>
          <h1 className='text-md'>Administrator accounts</h1>
          <span className='text-secondary-light text-xs text-montreal-mono'>
            {accounts.length || '...'}
          </span>
        </div>

        {accounts.length === 0 ? (
          <p className='text-secondary-light text-sm'>Loading...</p>
        ) : (
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-secondary-light text-[11px] uppercase text-montreal-mono'>
                <th className='text-left font-normal pb-2'>Username</th>
                <th className='text-left font-normal pb-2'>Created</th>
                <th className='pb-2' />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className='border-t border-secondary-main/20'>
                  <td className='py-2.5 pr-4 break-all'>{account.userName}</td>
                  <td className='py-2.5 pr-4 text-secondary-light text-xs text-montreal-mono'>
                    {new Date(account.createdAt).toLocaleDateString()}
                  </td>
                  <td className='py-2.5 text-right'>
                    <button
                      type='button'
                      disabled={busy || accounts.length <= 1}
                      onClick={() => remove(account)}
                      title={
                        accounts.length <= 1
                          ? 'The last administrator cannot be removed'
                          : 'Remove this administrator'
                      }
                      className='p-2 rounded-md text-secondary-light transition-all duration-300 hover:text-red-400 hover:bg-body-main/40 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-secondary-light'
                    >
                      <MdDelete />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className='text-secondary-light text-xs'>
          The last remaining account cannot be removed, and you cannot remove the
          one you are signed in as.
        </p>
      </div>

      <div className='grid lg:grid-cols-2 gap-5'>
        <form
          onSubmit={submitPassword}
          className='box-big-shadow bg-primary-dark rounded-xl p-6 grid gap-4 content-start'
        >
          <div className='grid gap-1 border-b border-secondary-main/30 pb-4'>
            <h2 className='text-md flex items-center gap-2'>
              <MdLockReset /> Change my password
            </h2>
            <p className='text-secondary-light text-sm'>
              Your current password is required as well as your session, so an
              unlocked laptop is not enough to take the account over.
            </p>
          </div>
          <Labelled label='Current password'>
            <input
              className={field}
              type='password'
              autoComplete='current-password'
              value={pw.current}
              onChange={(e) => setPw((v) => ({ ...v, current: e.target.value }))}
              required
            />
          </Labelled>
          <Labelled label={`New password, at least ${MINIMUM_PASSWORD_LENGTH} characters`}>
            <input
              className={field}
              type='password'
              autoComplete='new-password'
              value={pw.next}
              onChange={(e) => setPw((v) => ({ ...v, next: e.target.value }))}
              required
            />
          </Labelled>
          <Labelled label='Confirm new password'>
            <input
              className={field}
              type='password'
              autoComplete='new-password'
              value={pw.confirm}
              onChange={(e) => setPw((v) => ({ ...v, confirm: e.target.value }))}
              required
            />
          </Labelled>
          <div className='flex justify-end pt-1'>
            <button
              type='submit'
              disabled={busy}
              className='text-sm px-4 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main disabled:opacity-40'
            >
              Update password
            </button>
          </div>
        </form>

        <form
          onSubmit={submitNewAdmin}
          className='box-big-shadow bg-primary-dark rounded-xl p-6 grid gap-4 content-start'
        >
          <div className='grid gap-1 border-b border-secondary-main/30 pb-4'>
            <h2 className='text-md flex items-center gap-2'>
              <MdPersonAdd /> Add an administrator
            </h2>
            <p className='text-secondary-light text-sm'>
              There is no self service registration. A new account can only be
              created by an existing one.
            </p>
          </div>
          <Labelled label='Username'>
            <input
              className={field}
              type='text'
              autoComplete='off'
              placeholder='letters, digits, dot, underscore, hyphen'
              value={nw.userName}
              onChange={(e) => setNw((v) => ({ ...v, userName: e.target.value }))}
              required
            />
          </Labelled>
          <Labelled label={`Password, at least ${MINIMUM_PASSWORD_LENGTH} characters`}>
            <input
              className={field}
              type='password'
              autoComplete='new-password'
              value={nw.password}
              onChange={(e) => setNw((v) => ({ ...v, password: e.target.value }))}
              required
            />
          </Labelled>
          <Labelled label='Confirm password'>
            <input
              className={field}
              type='password'
              autoComplete='new-password'
              value={nw.confirm}
              onChange={(e) => setNw((v) => ({ ...v, confirm: e.target.value }))}
              required
            />
          </Labelled>
          <Labelled label='Your own password, to confirm'>
            <input
              className={field}
              type='password'
              autoComplete='current-password'
              value={nw.current}
              onChange={(e) => setNw((v) => ({ ...v, current: e.target.value }))}
              required
            />
          </Labelled>
          <div className='flex justify-end pt-1'>
            <button
              type='submit'
              disabled={busy}
              className='text-sm px-4 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main disabled:opacity-40'
            >
              Create administrator
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Labelled = ({ label, children }) => (
  <label className='grid gap-1.5'>
    <span className='text-secondary-light text-[11px] uppercase text-montreal-mono'>
      {label}
    </span>
    {children}
  </label>
);

Labelled.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

AccountManager.propTypes = {
  setPopup: PropTypes.func.isRequired,
};

export default AccountManager;
