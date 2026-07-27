import axios from 'axios';
import { useEffect, useState } from 'react';
import { reqs } from '../../../axios/requests';
import Technologies from '../../../components/Admin/Settings/Technologies';
import ResumeManager from '../../../components/Admin/Settings/ResumeManager';
import AccountManager from '../../../components/Admin/Settings/AccountManager';
import PersonalInfo from '../../../components/Admin/Settings/PersonalInfo';
import Popup from '../../../components/utils/Popup';
import { useOutletContext } from 'react-router-dom';

const Settings = () => {
  const { setPageTitle, searchTerm } = useOutletContext();
  const [mode, setMode] = useState('edit'); //create|edit
  const [settings, setSettings] = useState({
    technologies: undefined,
  });
  const [popUp, setPopup] = useState({
    text: '',
    type: 'normal',
    state: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageTitle('Settings');
    axios
      .get(reqs.GET_SETTINGS, { withCredentials: true })
      .then((res) => {
        if (res.data.succeed) {
          if (!res.data.result) setMode('create');
          else setSettings(res.data.result);
        }
      })
      .catch((err) => {
        console.error('Error fetching settings:', err);
      });
  }, [setPageTitle]);

  const handleCreateSettings = (data) => {
    if (mode === 'create') {
      setLoading(true);
      setPopup({
        text: 'updating Settings...',
        type: 'normal',
        state: true,
      });
      axios
        .post(
          reqs.ADD_SETTINGS,
          { ...settings, ...data },
          { withCredentials: true }
        )
        .then((res) => {
          setLoading(false);
          if (res.data.succeed) {
            setSettings(res.data.settings);
            setPopup({
              text: res.data.msg,
              type: 'success',
              state: true,
            });
          }
        })
        .catch((err) => {
          setLoading(false);
          setPopup({
            text: err.response?.data?.msg || 'Failed to update settings',
            type: 'error',
            state: true,
          });
        });
    } else {
      return;
    }
  };

  const handleEditSettings = (data) => {
    setLoading(true);
    setPopup({
      text: 'updating Settings...',
      type: 'normal',
      state: true,
    });
    if (mode === 'edit') {
      axios
        .patch(`${reqs.EDIT_SETTINGS}/${settings.id}`, data, {
          withCredentials: true,
        })
        .then((res) => {
          setLoading(false);
          if (res.data.succeed) {
            setSettings((settings) => ({ ...settings, ...data }));
            setPopup({
              text: res.data.msg,
              type: 'success',
              state: true,
            });
          }
        })
        .catch((err) => {
          setLoading(false);
          setPopup({
            text: err.response?.data?.msg || 'Failed to edit settings',
            type: 'error',
            state: true,
          });
        });
    } else {
      return;
    }
  };

  /**
   * Settings grew from one card to three, and a single scrolling column made
   * the resume and account sections easy to miss below the fold. Tabs keep each
   * concern on its own screen.
   *
   * The active tab lives in the URL hash, so a reload or a bookmark returns to
   * the same place rather than always snapping back to the first tab.
   */
  const TABS = [
    { key: 'technologies', label: 'Technologies' },
    { key: 'personal', label: 'Personal info' },
    { key: 'resume', label: 'Resume' },
    { key: 'accounts', label: 'Accounts' },
  ];

  const tabFromHash = () => {
    const key = window.location.hash.replace('#', '');
    return TABS.some((t) => t.key === key) ? key : 'technologies';
  };

  const [tab, setTab] = useState(tabFromHash);

  // Keeps the tab in step with the address bar when the hash changes without a
  // remount: a #tab link followed while already on this page, or the back
  // button. Without it the URL and the visible tab disagree.
  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTab = (key) => {
    setTab(key);
    // replaceState rather than assigning location.hash: the latter pushes a
    // history entry per click, so Back would walk through tabs instead of
    // leaving the page.
    window.history.replaceState(null, '', `#${key}`);
  };

  return (
    <div className='h-full w-full grid gap-5'>
      <div className='flex items-center gap-1 border-b border-secondary-main/40'>
        {TABS.map((item) => (
          <button
            key={item.key}
            type='button'
            onClick={() => selectTab(item.key)}
            className={`px-4 py-2.5 text-sm transition-all duration-300 border-b-2 -mb-px ${
              tab === item.key
                ? 'border-onPrimary-main text-primary-main'
                : 'border-transparent text-secondary-light hover:text-primary-main'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className='grid grid-cols-9 gap-5'>
        {tab === 'technologies' && (
          <Technologies
            mode={mode}
            settings={settings}
            handleCreateSettings={handleCreateSettings}
            handleEditSettings={handleEditSettings}
          />
        )}

        {/*
          The resume tab needs a settings row to attach to. In `create` mode
          there is none, and the server would reject the upload, so it says so
          instead of offering a control that cannot work.
        */}
        {tab === 'resume' &&
          (mode === 'edit' ? (
            <ResumeManager
              settings={settings}
              setPopup={setPopup}
              onChange={(patch) =>
                setSettings((current) => ({ ...current, ...patch }))
              }
            />
          ) : (
            <div className='col-span-9 box-big-shadow bg-primary-dark rounded-xl p-8'>
              <p className='text-secondary-light text-sm'>
                Save the technologies section first. The resume attaches to the
                settings record, which does not exist yet.
              </p>
            </div>
          ))}

        {/* Employment, education and achievements shown on the About page. */}
        {tab === 'personal' && (
          <PersonalInfo setPopup={setPopup} searchTerm={searchTerm} />
        )}

        {/* Account management does not depend on the settings row existing. */}
        {tab === 'accounts' && <AccountManager setPopup={setPopup} />}
      </div>
      <Popup
        setPopup={setPopup}
        state={popUp.state}
        loading={loading}
        text={popUp.text}
        type={popUp.type}
      />
    </div>
  );
};

export default Settings;
