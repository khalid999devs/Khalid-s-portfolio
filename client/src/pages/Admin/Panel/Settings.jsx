import axios from 'axios';
import { useEffect, useState } from 'react';
import { reqs } from '../../../axios/requests';
import Technologies from '../../../components/Admin/Settings/Technologies';
import Popup from '../../../components/utils/Popup';
import { useOutletContext } from 'react-router-dom';

const Settings = () => {
  const { setPageTitle } = useOutletContext();
  const [mode, setMode] = useState('loading'); //loading|create|edit|error
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
    const controller = new AbortController();
    setPageTitle('Settings');
    axios
      .get(reqs.GET_SETTINGS, { signal: controller.signal })
      .then((res) => {
        if (res.data.succeed) {
          if (!res.data.result) {
            setMode('create');
          } else {
            setMode('edit');
            setSettings(res.data.result);
          }
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setMode('error');
        setPopup({
          text: err.response?.data?.msg || 'Failed to load settings',
          type: 'error',
          state: true,
        });
      });

    return () => controller.abort();
  }, [setPageTitle]);

  const handleCreateSettings = async (data) => {
    if (mode !== 'create' || loading) return;

    setLoading(true);
    setPopup({
      text: 'Updating settings...',
      type: 'normal',
      state: true,
    });

    try {
      const res = await axios.post(reqs.ADD_SETTINGS, data);
      if (res.data.succeed) {
        setSettings(res.data.settings);
        setMode('edit');
        setPopup({
          text: res.data.msg,
          type: 'success',
          state: true,
        });
      }
    } catch (err) {
      setPopup({
        text: err.response?.data?.msg || 'Failed to update settings',
        type: 'error',
        state: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSettings = async (data) => {
    if (mode !== 'edit' || loading || !settings.id) return;

    setLoading(true);
    setPopup({
      text: 'Updating settings...',
      type: 'normal',
      state: true,
    });

    try {
      const res = await axios.patch(
        `${reqs.EDIT_SETTINGS}/${settings.id}`,
        data
      );
      if (res.data.succeed) {
        setSettings((currentSettings) => ({
          ...currentSettings,
          ...data,
        }));
        setPopup({
          text: res.data.msg,
          type: 'success',
          state: true,
        });
      }
    } catch (err) {
      setPopup({
        text: err.response?.data?.msg || 'Failed to edit settings',
        type: 'error',
        state: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='h-full w-full grid grid-cols-9 gap-5'>
      <Technologies
        mode={mode}
        settings={settings}
        disabled={loading || !['create', 'edit'].includes(mode)}
        handleCreateSettings={handleCreateSettings}
        handleEditSettings={handleEditSettings}
      />
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
