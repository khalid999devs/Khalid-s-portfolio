import React, { createContext, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/Navs/Navbar';
import Footer from './components/Footer/Footer';
import axios from 'axios';
import { reqs } from './axios/requests';
import { useMouseHoverAnimation } from './animations/useMouseHoverAnimation';

const AppContext = createContext({});

const App = () => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});
  const [appData, setAppData] = useState({ projects: [] });
  useMouseHoverAnimation();

  useEffect(() => {
    setLoading(true);
    axios
      .get(reqs.GET_SETTINGS)
      .then((res) => {
        if (res.data.succeed) {
          setSettings(res.data.result);
        }
        return axios.post(reqs.GET_PROJECT, { mode: 'all' });
      })
      .then((res) => {
        if (res.data.succeed) {
          setAppData((appData) => ({ ...appData, projects: res.data.result }));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  return (
    <AppContext.Provider
      value={{
        loading,
        setLoading,
        settings,
        setSettings,
        appData,
      }}
    >
      <div className='bg-body-main min-h-screen w-full'>
        <Navbar />
        <div>
          <Outlet />
        </div>
        <Footer />
      </div>
    </AppContext.Provider>
  );
};

export default App;

export const useAppContext = () => {
  return useContext(AppContext);
};
