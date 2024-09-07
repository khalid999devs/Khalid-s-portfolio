import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { reqs } from '../../../axios/requests';
import Technologies from '../../../components/Admin/Settings/Technologies';
import Popup from '../../../components/utils/Popup';

const Settings = () => {
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
    axios
      .get(reqs.GET_SETTINGS, { withCredentials: true })
      .then((res) => {
        if (res.data.succeed) {
          if (!res.data.result) setMode('create');
          else setSettings(res.data.result);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

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
            text: err.response.data.msg,
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
            text: err.response.data.msg,
            type: 'error',
            state: true,
          });
        });
    } else {
      return;
    }
  };

  // console.log(settings);

  return (
    <div className='h-full w-full grid grid-cols-9 gap-5'>
      <Technologies
        mode={mode}
        settings={settings}
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
