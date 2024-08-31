import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { reqs } from '../../../axios/requests';
import Technologies from '../../../components/Admin/Settings/Technologies';

const Settings = () => {
  const [mode, setMode] = useState('edit'); //create|edit
  const [settings, setSettings] = useState({
    technologies: undefined,
  });

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
      axios
        .post(
          reqs.ADD_SETTINGS,
          { ...settings, ...data },
          { withCredentials: true }
        )
        .then((res) => {
          if (res.data.succeed) {
            setSettings(res.data.settings);
          }
        })
        .catch((err) => {
          console.log(err);
          alert(err.response.data.msg);
        });
    }
  };

  const handleEditSettings = (data) => {
    if (mode === 'edit') {
      axios
        .patch(reqs.EDIT_SETTINGS, data, { withCredentials: true })
        .then((res) => {
          if (res.data.succeed) {
            setSettings((settings) => ({ ...settings, ...data }));
          }
        })
        .catch((err) => {
          console.log(err);
          alert(err.response.data.msg);
        });
    }
  };

  // console.log(settings);

  return (
    <div className='h-full w-full grid grid-cols-7 gap-5'>
      <Technologies
        mode={mode}
        settings={settings}
        handleCreateSettings={handleCreateSettings}
        handleEditSettings={handleEditSettings}
      />
    </div>
  );
};

export default Settings;
